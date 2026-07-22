"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { eciToEcf, gstime, json2satrec, propagate } from "satellite.js";
import type { EarthOrbitObject, OrbitalMode, OrbitalSnapshot } from "@/packages/shared/orbital-types";

const EARTH_RADIUS_KM = 6_378.137;
const EARTH_SCENE_RADIUS = 5;

function disposeScene(scene: THREE.Scene): void {
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points) {
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) material.dispose();
    }
  });
}

function addStars(scene: THREE.Scene): void {
  const count = 700;
  const positions = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    const unit = (index + 0.5) / count;
    const phi = Math.acos(1 - 2 * unit);
    const theta = index * 2.399963229728653;
    const radius = 62 + (index % 11) * 0.7;
    positions[index * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[index * 3 + 1] = radius * Math.cos(phi);
    positions[index * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  scene.add(new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0x8bb7c7, size: 0.08, transparent: true, opacity: 0.65, sizeAttenuation: true })));
}

function addOrbitRing(scene: THREE.Scene, radius: number, color = 0x2d6878, opacity = 0.35): THREE.LineLoop {
  const points = Array.from({ length: 160 }, (_, index) => {
    const angle = index / 160 * Math.PI * 2;
    return new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
  });
  const line = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
  );
  scene.add(line);
  return line;
}

function addEarth(scene: THREE.Scene, position = new THREE.Vector3()): THREE.Group {
  const group = new THREE.Group();
  group.position.copy(position);
  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_SCENE_RADIUS, 64, 40),
    new THREE.MeshPhongMaterial({ color: 0x092f45, emissive: 0x03121d, specular: 0x4cc9e8, shininess: 22 }),
  );
  group.add(earth);
  const grid = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_SCENE_RADIUS * 1.006, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0x5bd6eb, wireframe: true, transparent: true, opacity: 0.075 }),
  );
  group.add(grid);
  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_SCENE_RADIUS * 1.08, 48, 32),
    new THREE.MeshBasicMaterial({ color: 0x45cae9, transparent: true, opacity: 0.055, side: THREE.BackSide }),
  );
  group.add(atmosphere);
  scene.add(group);
  return group;
}

function propagatedPosition(object: EarthOrbitObject, date: Date): THREE.Vector3 | null {
  try {
    const satrec = json2satrec(object.elements);
    const state = propagate(satrec, date);
    if (!state) return null;
    const fixed = eciToEcf(state.position, gstime(date));
    const scale = EARTH_SCENE_RADIUS / EARTH_RADIUS_KM;
    return new THREE.Vector3(fixed.x * scale, fixed.z * scale, -fixed.y * scale);
  } catch {
    return null;
  }
}

function objectColor(object: EarthOrbitObject): number {
  if (object.attentionState === "stale") return 0x8a9aa5;
  if (object.orbitClass === "GEO") return 0xe5a83d;
  if (object.orbitClass === "MEO") return 0xb6a7ff;
  return 0x63d9ee;
}

function addEarthOrbitScene(
  scene: THREE.Scene,
  snapshot: OrbitalSnapshot,
  selectedId: string,
  date: Date,
): THREE.Object3D[] {
  addEarth(scene);
  scene.add(new THREE.AmbientLight(0x8bbbc7, 0.55));
  const light = new THREE.DirectionalLight(0xeafaff, 2.2);
  light.position.set(12, 8, 16);
  scene.add(light);
  const pickable: THREE.Object3D[] = [];
  for (const object of snapshot.earthOrbitObjects) {
    const position = propagatedPosition(object, date);
    if (!position) continue;
    const selected = object.id === selectedId;
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(selected ? 0.22 : 0.13, 16, 12),
      new THREE.MeshBasicMaterial({ color: objectColor(object) }),
    );
    marker.position.copy(position);
    marker.userData.objectId = object.id;
    scene.add(marker);
    pickable.push(marker);
    if (selected) {
      const pulse = new THREE.Mesh(
        new THREE.RingGeometry(0.3, 0.43, 32),
        new THREE.MeshBasicMaterial({ color: 0xe7fbff, transparent: true, opacity: 0.75, side: THREE.DoubleSide }),
      );
      pulse.position.copy(position);
      pulse.lookAt(0, 0, 0);
      scene.add(pulse);
    }
    const meanMotion = Number(object.elements.MEAN_MOTION);
    if (!Number.isFinite(meanMotion) || meanMotion <= 0) continue;
    const periodMs = 86_400_000 / meanMotion;
    const points = Array.from({ length: selected ? 160 : 64 }, (_, index) => {
      const sample = new Date(date.getTime() + (index / (selected ? 159 : 63) - 0.5) * periodMs);
      return propagatedPosition(object, sample);
    }).filter((value): value is THREE.Vector3 => value !== null);
    if (points.length > 2) {
      scene.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({ color: objectColor(object), transparent: true, opacity: selected ? 0.75 : 0.16 }),
      ));
    }
  }
  return pickable;
}

function addSun(scene: THREE.Scene): THREE.Mesh {
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(2.6, 48, 32),
    new THREE.MeshBasicMaterial({ color: 0xffc654 }),
  );
  scene.add(sun);
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(3.1, 40, 24),
    new THREE.MeshBasicMaterial({ color: 0xffb329, transparent: true, opacity: 0.12, side: THREE.BackSide }),
  );
  scene.add(glow);
  return sun;
}

function addSolarSystem(scene: THREE.Scene, snapshot: OrbitalSnapshot, mode: OrbitalMode): THREE.Object3D[] {
  addSun(scene);
  scene.add(new THREE.AmbientLight(0x9bb7c0, 0.65));
  const planetData = [
    { name: "Mercury", radius: 5, size: 0.22, color: 0xa9a39a, phase: 0.2 },
    { name: "Venus", radius: 7.4, size: 0.35, color: 0xd7a958, phase: 2.1 },
    { name: "Earth", radius: 10.3, size: 0.44, color: 0x4cc9e8, phase: 4.3 },
    { name: "Mars", radius: 13.8, size: 0.31, color: 0xd56d52, phase: 5.2 },
    { name: "Jupiter", radius: 20.5, size: 0.92, color: 0xd6b28b, phase: 1.3 },
  ];
  const pickable: THREE.Object3D[] = [];
  for (const planet of planetData) {
    addOrbitRing(scene, planet.radius, planet.name === "Earth" ? 0x4cc9e8 : 0x315664, planet.name === "Earth" ? 0.55 : 0.24);
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(planet.size, 24, 16),
      new THREE.MeshBasicMaterial({ color: planet.color }),
    );
    mesh.position.set(Math.cos(planet.phase) * planet.radius, 0, Math.sin(planet.phase) * planet.radius);
    mesh.userData.objectId = `planet:${planet.name.toLocaleLowerCase("en-US")}`;
    scene.add(mesh);
  }
  const earth = planetData[2];
  const earthPosition = new THREE.Vector3(Math.cos(earth.phase) * earth.radius, 0, Math.sin(earth.phase) * earth.radius);
  if (mode === "near-earth") {
    const selected = snapshot.closeApproaches[0];
    const approachPoints = Array.from({ length: 90 }, (_, index) => {
      const unit = index / 89;
      const across = (unit - 0.5) * 14;
      return new THREE.Vector3(earthPosition.x + across, Math.sin(unit * Math.PI) * 2.2, earthPosition.z + 3.2 - unit * 6.4);
    });
    scene.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(approachPoints),
      new THREE.LineBasicMaterial({ color: 0xe5a83d, transparent: true, opacity: 0.72 }),
    ));
    const asteroid = new THREE.Mesh(new THREE.IcosahedronGeometry(0.24, 1), new THREE.MeshBasicMaterial({ color: 0xe6c38b }));
    asteroid.position.copy(approachPoints[58]);
    if (selected) asteroid.userData.objectId = selected.id;
    scene.add(asteroid);
    pickable.push(asteroid);
  } else if (snapshot.spaceWeatherEvents.some((event) => event.type === "cme")) {
    const direction = earthPosition.clone().normalize();
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(3.2, 10, 48, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xf0a13a, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
    );
    cone.position.copy(direction.clone().multiplyScalar(6));
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    scene.add(cone);
  }
  return pickable;
}

export function OrbitalScene({
  mode,
  snapshot,
  selectedId,
  simulationTime,
  onSelect,
}: {
  mode: OrbitalMode;
  snapshot: OrbitalSnapshot;
  selectedId: string;
  simulationTime: number;
  onSelect(id: string): void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    setFailed(false);
    let disposed = false;
    let frame = 0;
    let observer: ResizeObserver | undefined;
    try {
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.setClearColor(0x03070b, 1);
      container.replaceChildren(renderer.domElement);
      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x03070b, 0.008);
      addStars(scene);
      const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 200);
      camera.position.set(mode === "earth-orbit" ? 14 : 7, mode === "earth-orbit" ? 8 : 18, mode === "earth-orbit" ? 18 : 31);
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.06;
      controls.minDistance = mode === "earth-orbit" ? 7 : 8;
      controls.maxDistance = mode === "earth-orbit" ? 52 : 70;
      controls.target.set(mode === "earth-orbit" ? 0 : 4, 0, 0);
      const pickable = mode === "earth-orbit"
        ? addEarthOrbitScene(scene, snapshot, selectedId, new Date(simulationTime))
        : addSolarSystem(scene, snapshot, mode);
      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      const selectAt = (event: PointerEvent) => {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObjects(pickable, false)[0];
        const id = hit?.object.userData.objectId;
        if (typeof id === "string") onSelect(id);
      };
      renderer.domElement.addEventListener("pointerup", selectAt);
      const resize = () => {
        const width = Math.max(1, container.clientWidth);
        const height = Math.max(1, container.clientHeight);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
      };
      observer = new ResizeObserver(resize);
      observer.observe(container);
      resize();
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const render = () => {
        if (disposed) return;
        if (!document.hidden) {
          if (!reducedMotion && mode === "earth-orbit") scene.rotation.y += 0.00035;
          controls.update();
          renderer.render(scene, camera);
        }
        frame = window.requestAnimationFrame(render);
      };
      render();
      return () => {
        disposed = true;
        window.cancelAnimationFrame(frame);
        observer?.disconnect();
        renderer.domElement.removeEventListener("pointerup", selectAt);
        controls.dispose();
        disposeScene(scene);
        renderer.dispose();
        renderer.forceContextLoss();
        if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      };
    } catch {
      let active = true;
      queueMicrotask(() => {
        if (active) setFailed(true);
      });
      return () => {
        active = false;
      };
    }
  }, [mode, onSelect, selectedId, simulationTime, snapshot]);

  return (
    <div className="orbital-scene" aria-label={`Interactive ${mode.replaceAll("-", " ")} 3D scene`}>
      <div ref={containerRef} className="orbital-scene-canvas" />
      {failed ? (
        <div className="orbital-scene-fallback" role="status">
          <strong>3D scene unavailable</strong>
          <span>The synchronized object table and source details remain available.</span>
        </div>
      ) : null}
      <div className="orbital-scale-note">{mode === "earth-orbit" ? "Propagated SGP4 positions · altitude scale preserved" : "Compressed illustrative scale · not for navigation"}</div>
    </div>
  );
}

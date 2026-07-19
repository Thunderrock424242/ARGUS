import Link from "next/link";
import { BriefsIndex } from "@/components/pages/briefs-index";
import { DemoBanner, PageHeader, primaryButtonClass } from "@/components/domain/argus-ui";
import { demoBriefs } from "@/packages/shared/demo-data";

export default function BriefsPage() {
  return <main className="route-page page-stack space-y-5 p-4 sm:p-6 xl:p-8"><DemoBanner /><PageHeader eyebrow="Strategic reporting / 06" title="Intelligence briefs" description="Read polished daily, weekly, and custom assessments assembled from stored ARGUS events, explicit collection gaps, confidence changes, and attributed Aether analysis." actions={<Link className={primaryButtonClass} href="/aether?mode=brief-generation">Generate with Aether</Link>} /><BriefsIndex briefs={demoBriefs} /></main>;
}

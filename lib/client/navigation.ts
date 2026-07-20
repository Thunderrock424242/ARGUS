import {
  useLocation,
  useNavigate,
  useSearchParams as useRouterSearchParams,
} from "react-router-dom";

export function usePathname(): string {
  return useLocation().pathname;
}

export function useRouter() {
  const navigate = useNavigate();
  return {
    push(href: string) {
      navigate(href);
    },
  };
}

export function useSearchParams(): URLSearchParams {
  return useRouterSearchParams()[0];
}

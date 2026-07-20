import type { AnchorHTMLAttributes } from "react";
import { Link as RouterLink } from "react-router-dom";

export interface LinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: string;
}

export default function Link({ href, ...props }: LinkProps) {
  const external = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href);
  if (external) return <a href={href} {...props} />;
  return <RouterLink to={href} {...props} />;
}

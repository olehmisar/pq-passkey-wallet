import { GithubLogo } from "@phosphor-icons/react";

const REPO_URL = "https://github.com/olehmisar/pq-passkey-wallet";

export function AppFooter() {
  return (
    <footer className="mt-auto px-4 py-6 text-center">
      <a
        href={REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-[13px] text-(--color-ios-secondary) transition-colors hover:text-(--color-ios-tint)"
      >
        <GithubLogo size={16} weight="fill" aria-hidden />
        GitHub
      </a>
    </footer>
  );
}

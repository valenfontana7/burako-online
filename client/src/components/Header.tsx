import type { ReactNode } from "react";

type Props = {
  shouldRenderHeader: boolean;
  activeTable: unknown;
  showCompactTabsInHeader: boolean;
  appHeaderClassName: string;
  renderCompactTabNav?: () => ReactNode;
};

export default function Header({
  shouldRenderHeader,
  activeTable,
  showCompactTabsInHeader,
  appHeaderClassName,
  renderCompactTabNav,
}: Props) {
  if (!shouldRenderHeader) return null;

  return (
    <header className={appHeaderClassName}>
      {!activeTable && (
        <div>
          <h1>Burako Online</h1>
          <p className="app__subtitle">Lobby temprano · Real-time</p>
        </div>
      )}
      {showCompactTabsInHeader && renderCompactTabNav && renderCompactTabNav()}
    </header>
  );
}

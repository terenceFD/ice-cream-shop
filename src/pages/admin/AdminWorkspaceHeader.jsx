import { AdminIcon } from "./AdminPageHeader";
import { adminIcons } from "./adminIcons";

export function AdminWorkspaceHeader({ title, description, actions, t }) {
  return (
    <header className="workspace-page-header">
      <div>
        <p className="workspace-context">{t("Workspace")}</p>
        <h1>{title}</h1>
        <p className="workspace-description">{description}</p>
      </div>
      {actions && <div className="workspace-header-actions">{actions}</div>}
    </header>
  );
}

export function WorkspaceEmpty({ title, description, children }) {
  return (
    <div className="workspace-empty">
      <AdminIcon path={adminIcons.history} />
      <p>{title}</p>
      {description && <span>{description}</span>}
      {children}
    </div>
  );
}

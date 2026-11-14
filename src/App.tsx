// Séance root: `/seance` is the workspace, every other path is the landing (Req 11.1)
import { Workspace } from './components/Workspace.tsx'
import { Landing } from './components/Landing.tsx'
import { isWorkspacePath } from './lib/copy.ts'

export default function App({ pathname = window.location.pathname }: { pathname?: string }) {
  return isWorkspacePath(pathname) ? <Workspace /> : <Landing />
}

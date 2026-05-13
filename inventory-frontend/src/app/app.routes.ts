import { Routes } from '@angular/router';

import { MainLayout } from './layout/main-layout/main-layout';

import { Dashboards } from './dashboards/dashboards';
import { Users } from './users/users';
import { AssetsHub } from './assets/assets-hub';
import { AssetsCategory } from './assets/assets-category';
import { AssetsInventoryWorkspace } from './assets/inventory-workspace/inventory-workspace';
import { Repairs } from './repairs/repairs';
import { SessionsRedirect } from './sessions/sessions-redirect.component';
import { RepairCostLog } from './repair-cost-log/repair-cost-log';
import { DisposedItems } from './disposed-items/disposed-items';
import { Home } from './home/home';
import { Login } from './login/login';
import { Signup } from './signup/signup';
import { NotAuthorized } from './not-authorized/not-authorized';
import { AuthGuard } from './auth.guard';
import { AdminGuard } from './admin.guard';
import { RepairAuthorityGuard } from './repair-authority.guard';
import { AssetDetails } from './asset-details/asset-details';
import { MyWorkspace } from './my-workspace/my-workspace';
import { AssignmentRequestsAdmin } from './assignment-requests-admin/assignment-requests-admin';
import { RepairAuthorityPanel } from './repair-authority-panel/repair-authority-panel';
import { RagAdmin } from './rag-admin/rag-admin';

export const routes: Routes = [
  { path: 'login',  component: Login  },   // ✅ no sidebar/header
  { path: 'signup', component: Signup }, 
  {path:'not-authorized',component:NotAuthorized},  // ✅ no sidebar/header
  { path: 'asset-details',  component: AssetDetails  },
  {
    path: '',
    component: MainLayout,
    children: [
      { path: '',           component: Home },           // ✅ free
      { path: 'dashboard',  component: Dashboards,  canActivate: [AdminGuard] },
      { path: 'assets/inv/:invId', component: AssetsInventoryWorkspace, canActivate: [AuthGuard] },
      { path: 'assets',             component: AssetsHub,        canActivate: [AuthGuard] },
      { path: 'assets/:category',   component: AssetsCategory,    canActivate: [AuthGuard] },
      { path: 'users',      component: Users,      canActivate: [AuthGuard] },
      {
        path: 'sessions',
        component: SessionsRedirect,
        canActivate: [AdminGuard],
      },
      { path: 'disposed',   component: DisposedItems, canActivate: [AdminGuard] },
      { path: 'repairs',        component: Repairs,        canActivate: [AuthGuard] },
      { path: 'repair-costs',   component: RepairCostLog,  canActivate: [AuthGuard] },
      { path: 'my-workspace', component: MyWorkspace, canActivate: [AuthGuard] },
      { path: 'assignment-requests', component: AssignmentRequestsAdmin, canActivate: [AdminGuard] },
      { path: 'rag-admin', component: RagAdmin, canActivate: [AdminGuard] },
      { path: 'repair-authority', component: RepairAuthorityPanel, canActivate: [RepairAuthorityGuard] },
    ]
  },
  { path: '**', redirectTo: 'login' } 
];
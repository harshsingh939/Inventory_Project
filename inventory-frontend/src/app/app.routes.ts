import { Routes } from '@angular/router';

import { MainLayout } from './layout/main-layout/main-layout';

import { Dashboards } from './dashboards/dashboards';
import { Users } from './users/users';
import { Assets } from './assets/assets';
import { Sessions } from './sessions/sessions';
import { Repairs } from './repairs/repairs';
import { Home } from './home/home';
import { Login } from './login/login';
import { Signup } from './signup/signup';
import { NotAuthorized } from './not-authorized/not-authorized';
import { AuthGuard } from './auth.guard';
import { AdminGuard } from './admin.guard';
import { AssetDetails } from './asset-details/asset-details';

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
      { path: 'assets',     component: Assets,     canActivate: [AuthGuard] },
      { path: 'users',      component: Users,      canActivate: [AuthGuard] },
      { path: 'sessions',   component: Sessions,   canActivate: [AdminGuard] },
      { path: 'repairs',    component: Repairs,    canActivate: [AuthGuard] },
    ]
  },
  { path: '**', redirectTo: 'login' } 
];
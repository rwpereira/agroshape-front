import { Routes } from '@angular/router';
import { MapaComponent } from './mapa/mapa.component';

export const routes: Routes = [
    { path: 'mapa', component: MapaComponent },
    { path: '', redirectTo: '/mapa', pathMatch: 'full' }
];
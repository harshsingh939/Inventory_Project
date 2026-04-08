import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
// import { Sidebar } from './layout/sidebar/sidebar';


@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {}
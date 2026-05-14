import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastContainer } from './toast-container/toast-container';
// import { Sidebar } from './layout/sidebar/sidebar';


@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastContainer],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  
}
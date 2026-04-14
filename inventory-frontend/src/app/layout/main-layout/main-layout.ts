import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';

import { Header } from '../header/header';


@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, Header, RouterOutlet],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.css'
})
export class MainLayout{}


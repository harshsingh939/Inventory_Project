import { Component, OnInit } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-not-authorized',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './not-authorized.html',
  styleUrl: './not-authorized.css'
})
export class NotAuthorized implements OnInit {
  countdown = 2;

  constructor(private router: Router) {}

  ngOnInit() {
    const interval = setInterval(() => {
      this.countdown--;
      if (this.countdown === 0) {
        clearInterval(interval);
        this.router.navigate(['/login']);
      }
    }, 1000);
  }
}
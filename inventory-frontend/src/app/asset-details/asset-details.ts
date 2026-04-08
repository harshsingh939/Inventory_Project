import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'app-asset-details',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './asset-details.html',
  styleUrl: './asset-details.css'
})
export class AssetDetails implements OnInit {
  asset: any = {};

  constructor(private route: ActivatedRoute) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.asset = {
        id:      params['id'],
        type:    params['type'],
        brand:   params['brand'],
        model:   params['model'],
        serial:  params['serial'],
        cpu:     params['cpu'],
        ram:     params['ram'],
        storage: params['storage'],
        status:  params['status']
      };
    });
  }
}
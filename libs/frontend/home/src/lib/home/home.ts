import { NgOptimizedImage } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'hiking-downward-home',
  imports: [NgOptimizedImage, RouterLink],
  templateUrl: './home.ng.html',
})
/** Placeholder landing page that routes visitors to authentication. */
export class Home {}

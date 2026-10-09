import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'hiking-downward-status-page',
  imports: [RouterLink],
  templateUrl: './status-page.ng.html',
  styleUrl: './status-page.css',
})
/* v8 ignore start */
export class StatusPage {
  /* v8 ignore stop */
  public readonly code = input.required<string>();
  public readonly heading = input.required<string>();
  public readonly description = input.required<string>();
}

import { DomPortal, DomPortalOutlet } from '@angular/cdk/portal';

/**
 * Moves a dialog out of a transformed or stacked ancestor so a league header
 * cannot paint over it. The outlet is its own element: disposing a
 * DomPortalOutlet removes that element, and document.body must not be it.
 */
export class BodyDialogPortal {
  private outlet: DomPortalOutlet | null = null;
  private host: HTMLElement | null = null;

  attach(element: HTMLElement): void {
    if (this.host && element.parentElement === this.host) {
      return;
    }
    this.detach();
    this.host = document.createElement('div');
    document.body.appendChild(this.host);
    this.outlet = new DomPortalOutlet(this.host, undefined, undefined, undefined, document);
    this.outlet.attach(new DomPortal(element));
  }

  detach(): void {
    if (!this.outlet) {
      this.host = null;
      return;
    }
    this.outlet.dispose();
    this.outlet = null;
    this.host = null;
  }
}

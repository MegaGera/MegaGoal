import { Subscription } from 'rxjs';
import { MatSelect } from '@angular/material/select';

type PanelStrategy = {
  setOrigin(origin: HTMLElement): PanelStrategy;
  withPositions(positions: Array<{
    originX: 'center';
    originY: 'center';
    overlayX: 'center';
    overlayY: 'center';
  }>): PanelStrategy;
  withPush(canPush: boolean): PanelStrategy;
  withViewportMargin(margin: number): PanelStrategy;
  apply(): void;
};

type SelectOverlayDir = {
  attach: { subscribe(handler: () => void): Subscription };
  positionChange: { subscribe(handler: () => void): Subscription };
  _position?: PanelStrategy;
};

/**
 * Keeps a mat-select panel centered on the match card.
 * Material anchors the panel to the trigger and rewrites that position on scroll.
 * Point the existing overlay strategy at the card instead, so scroll keeps the center.
 */
export function bindLocationPanelToCard(
  select: MatSelect | undefined,
  card: () => HTMLElement | null,
): Subscription | undefined {
  const dir = (select as unknown as { _overlayDir?: SelectOverlayDir } | undefined)?._overlayDir;
  if (!dir) {
    return undefined;
  }

  let centering = false;
  const center = () => {
    if (centering) {
      return;
    }
    const strategy = dir._position;
    const origin = card();
    if (!strategy || !origin) {
      return;
    }
    centering = true;
    try {
      strategy
        .setOrigin(origin)
        .withPositions([{
          originX: 'center',
          originY: 'center',
          overlayX: 'center',
          overlayY: 'center',
        }])
        .withPush(true)
        .withViewportMargin(8)
        .apply();
    } finally {
      centering = false;
    }
  };

  const sub = new Subscription();
  sub.add(dir.attach.subscribe(() => center()));
  sub.add(dir.positionChange.subscribe(() => center()));
  return sub;
}

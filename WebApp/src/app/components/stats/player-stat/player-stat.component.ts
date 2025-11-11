import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-player-stat',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './player-stat.component.html',
  styleUrl: './player-stat.component.css'
})
export class PlayerStatComponent {
  @Input() icon!: string;
  @Input() label!: string;
  @Input() value!: number | string;
  @Input() subValue?: string;
}


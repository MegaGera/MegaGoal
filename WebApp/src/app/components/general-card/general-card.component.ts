import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-general-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './general-card.component.html',
  styleUrls: ['./general-card.component.css']
})
export class GeneralCardComponent {
  @Input() loading: boolean = false;
  @Input() empty: boolean = false;
  @Input() customClass: string = '';
} 
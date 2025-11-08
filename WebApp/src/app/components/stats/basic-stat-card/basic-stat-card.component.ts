import { Component, Input } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import { NgIconComponent } from '@ng-icons/core';

@Component({
  selector: 'app-basic-stat-card',
  standalone: true,
  imports: [CommonModule, NgClass, NgIconComponent],
  templateUrl: './basic-stat-card.component.html',
  styleUrls: ['./basic-stat-card.component.css']
})
export class BasicStatCardComponent {
  @Input() label!: string;
  @Input() value!: number | string;
  @Input() valueSuffix: string = '';
  @Input() subValue: number | string | null = null;
  @Input() icon!: string;
  @Input() iconClass: string = '';
  @Input() valueFormat: string = '1.0-0';
  @Input() subValueFormat: string = '1.2-2';

  isNumber(value: unknown): value is number {
    return typeof value === 'number' && !Number.isNaN(value);
  }
}


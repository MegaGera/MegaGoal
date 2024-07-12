import { Component, Input, model, ModelSignal, OnChanges, SimpleChanges } from '@angular/core';

@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [],
  templateUrl: './pagination.component.html',
  styleUrl: './pagination.component.css'
})
export class PaginationComponent implements OnChanges {

  @Input() elements: any[] = [];
  elementsFiltered: ModelSignal<any[]> = model<any[]>([]);
  @Input() elementsPerPage: number = 20;
  pages: number = 1;
  pageSelected: number = 1;

  constructor() { }
  
  ngOnChanges(changes: SimpleChanges) {
    if (changes['elementsPerPage'])
      console.log(changes['elementsPerPage'].currentValue);

    if (changes['elements']) {
      console.log(changes['elements'].currentValue);
      this.pages = Math.ceil(this.elements.length / this.elementsPerPage);
      this.changePageSelected(1);
    }
  }

  changePageSelected(page: number) {
    this.pageSelected = page;
    this.filterElements();
  }

  getArrayPages() {
    if (this.pages <= 10) {
      return new Array(this.pages).fill(0).map((x, i) => i + 1);
    } else {
      let startIndex = 0;
      let endIndex = 10;
      if (this.pageSelected > 5) {
        startIndex = this.pageSelected - 5;
        endIndex = this.pageSelected + 5;
      }
      if (this.pageSelected > this.pages - 5) {
        startIndex = this.pages - 10;
        endIndex = this.pages;
      }
      return new Array(this.pages).fill(0).map((x, i) => i + 1).slice(startIndex, endIndex);
    }
  }

  filterElements() {
    const startIndex = (this.pageSelected - 1) * this.elementsPerPage;
    const endIndex = startIndex + this.elementsPerPage;
    this.elementsFiltered.set(this.elements.slice(startIndex, endIndex));
  }

}

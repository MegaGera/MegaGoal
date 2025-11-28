import { Component, HostListener, Input, model, ModelSignal, OnChanges, OnInit, SimpleChanges, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [],
  templateUrl: './pagination.component.html',
  styleUrl: './pagination.component.css'
})
export class PaginationComponent implements OnInit, OnChanges {

  @Input() elements: any[] = [];
  elementsFiltered: ModelSignal<any[]> = model<any[]>([]);
  @Input() elementsPerPage: number = 20;
  @Input() initialPage: number = 1; // Allow external control of initial page
  @Output() pageChange = new EventEmitter<number>(); // Emit page changes
  pages: number = 1;
  pageSelected: number = 1;
  maxPagesToShow: number = 10;

  constructor() { }

  ngOnInit() {
    this.updateMaxPagesToShow();
    if (this.initialPage > 1) {
      this.pageSelected = this.initialPage;
      this.filterElements();
    }
  }

  @HostListener('window:resize', ['$event'])
  onResize() {
    this.updateMaxPagesToShow();
  }

  updateMaxPagesToShow() {
    if (window.innerWidth < 768) {
      // Mobile view: show fewer pages
      this.maxPagesToShow = 5;
    } else if (window.innerWidth < 1024) {
      // Tablet view: show medium number of pages
      this.maxPagesToShow = 7;
    } else {
      // Desktop view: show full number of pages
      this.maxPagesToShow = 10;
    }
  }
  
  ngOnChanges(changes: SimpleChanges) {
    if (changes['elementsPerPage'] || changes['elements']) {
      this.pages = Math.ceil(this.elements.length / this.elementsPerPage);
      // Only reset to page 1 if initialPage is not set or is 1
      if (this.initialPage && this.initialPage > 1 && this.initialPage <= this.pages) {
        this.pageSelected = this.initialPage;
      } else {
        this.pageSelected = 1;
      }
      this.filterElements();
    }
    if (changes['initialPage'] && this.initialPage && this.initialPage > 0 && this.initialPage <= this.pages) {
      this.pageSelected = this.initialPage;
      this.filterElements();
    }
  }

  changePageSelected(page: number) {
    this.pageSelected = page;
    this.filterElements();
    this.pageChange.emit(page);
  }

  getArrayPages() {
    if (this.pages <= this.maxPagesToShow) {
      return new Array(this.pages).fill(0).map((x, i) => i + 1);
    } else {
      const halfPages = Math.floor(this.maxPagesToShow / 2);
      let startIndex = 0;
      let endIndex = this.maxPagesToShow;
      if (this.pageSelected > halfPages) {
        startIndex = this.pageSelected - halfPages;
        endIndex = this.pageSelected + halfPages;
      }
      if (this.pageSelected > this.pages - halfPages) {
        startIndex = this.pages - this.maxPagesToShow;
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

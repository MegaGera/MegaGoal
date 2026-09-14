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
  @Input() initialPage: number = 1;
  /** When set, pagination is driven by total count (server-side); `elements` is the current page. */
  @Input() totalCount: number | null = null;
  @Output() pageChange = new EventEmitter<number>();
  pages: number = 1;
  pageSelected: number = 1;
  maxPagesToShow: number = 10;

  constructor() { }

  get isServerSide(): boolean {
    return this.totalCount !== null && this.totalCount !== undefined;
  }

  ngOnInit() {
    this.updateMaxPagesToShow();
    this.recomputePages();
    if (this.initialPage > 1) {
      this.pageSelected = this.clampPage(this.initialPage);
    }
    this.filterElements();
  }

  @HostListener('window:resize')
  onResize() {
    this.updateMaxPagesToShow();
  }

  updateMaxPagesToShow() {
    if (window.innerWidth < 768) {
      this.maxPagesToShow = 5;
    } else if (window.innerWidth < 1024) {
      this.maxPagesToShow = 7;
    } else {
      this.maxPagesToShow = 10;
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['elementsPerPage'] || changes['elements'] || changes['totalCount']) {
      this.recomputePages();

      if (this.isServerSide) {
        const preferred =
          changes['initialPage'] != null ? this.initialPage : this.pageSelected;
        this.pageSelected = this.clampPage(preferred || 1);
      } else if (this.initialPage > 1 && this.initialPage <= this.pages) {
        this.pageSelected = this.initialPage;
      } else {
        this.pageSelected = 1;
      }
      this.filterElements();
    }

    if (changes['initialPage'] && !changes['elements'] && !changes['totalCount'] && !changes['elementsPerPage']) {
      if (this.initialPage > 0) {
        this.pageSelected = this.clampPage(this.initialPage);
        this.filterElements();
      }
    }
  }

  private recomputePages(): void {
    const count = this.isServerSide ? (this.totalCount ?? 0) : this.elements.length;
    this.pages = count > 0 ? Math.ceil(count / this.elementsPerPage) : 0;
  }

  private clampPage(page: number): number {
    if (this.pages <= 0) {
      return 1;
    }
    return Math.min(Math.max(1, page), this.pages);
  }

  changePageSelected(page: number) {
    if (page < 1 || (this.pages > 0 && page > this.pages) || page === this.pageSelected) {
      return;
    }
    this.pageSelected = page;
    this.filterElements();
    this.pageChange.emit(page);
  }

  getArrayPages() {
    if (this.pages <= 0) {
      return [];
    }
    if (this.pages <= this.maxPagesToShow) {
      return new Array(this.pages).fill(0).map((_, i) => i + 1);
    }
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
    return new Array(this.pages).fill(0).map((_, i) => i + 1).slice(startIndex, endIndex);
  }

  filterElements() {
    if (this.isServerSide) {
      this.elementsFiltered.set(this.elements);
      return;
    }
    const startIndex = (this.pageSelected - 1) * this.elementsPerPage;
    const endIndex = startIndex + this.elementsPerPage;
    this.elementsFiltered.set(this.elements.slice(startIndex, endIndex));
  }

}

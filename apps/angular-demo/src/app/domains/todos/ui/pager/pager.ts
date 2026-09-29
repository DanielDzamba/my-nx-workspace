import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';

/** Previous / next page navigation; renders nothing when everything fits on one page. */
@Component({
  selector: 'app-pager',
  templateUrl: './pager.html',
  styleUrl: './pager.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Pager {
  /** Zero-based index of the current page. */
  readonly page = input.required<number>();
  readonly totalPages = input.required<number>();
  /** Emits the zero-based index of the requested page. */
  readonly pageChange = output<number>();

  protected readonly hasPrevious = computed(() => this.page() > 0);
  protected readonly hasNext = computed(
    () => this.page() < this.totalPages() - 1
  );
}

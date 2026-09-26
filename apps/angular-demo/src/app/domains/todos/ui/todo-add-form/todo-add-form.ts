import {
  ChangeDetectionStrategy,
  Component,
  model,
  output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-todo-add-form',
  imports: [FormsModule],
  templateUrl: './todo-add-form.html',
  styleUrl: './todo-add-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TodoAddForm {
  /** Text in the input. Two-way bound so the parent can clear it after a successful add. */
  readonly title = model('');
  /** Emits the trimmed, non-empty title. */
  readonly add = output<string>();

  protected submit(): void {
    const title = this.title().trim();
    if (title) {
      this.add.emit(title);
    }
  }
}

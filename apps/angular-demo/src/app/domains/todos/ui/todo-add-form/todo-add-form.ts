import {
  ChangeDetectionStrategy,
  Component,
  input,
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
  /** Accessible name of the input, e.g. "Nová podúloha" when used for subtasks. */
  readonly label = input('Nová úloha');
  readonly placeholder = input('Čo treba urobiť?');
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

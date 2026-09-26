import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'lib-mylib',
  imports: [],
  templateUrl: './mylib.html',
  styleUrl: './mylib.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Mylib {}

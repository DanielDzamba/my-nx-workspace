import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Mylib } from '@mylib';

@Component({
  imports: [RouterModule, Mylib],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected title = 'angular-demo';
}

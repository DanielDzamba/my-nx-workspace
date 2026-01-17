import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Mylib } from '@mylib';
import { NxWelcome } from './nx-welcome';

@Component({
  imports: [NxWelcome, RouterModule, Mylib],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected title = 'angular-demo';
}

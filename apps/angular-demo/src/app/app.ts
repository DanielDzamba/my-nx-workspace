import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Mylib } from '@mylib';
import { NotificationWidget } from './domains/notifications/feature-notification-widget';

@Component({
  imports: [RouterOutlet, Mylib, NotificationWidget],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {}

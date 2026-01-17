import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Mylib } from './mylib';

describe('Mylib', () => {
  let component: Mylib;
  let fixture: ComponentFixture<Mylib>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Mylib],
    }).compileComponents();

    fixture = TestBed.createComponent(Mylib);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

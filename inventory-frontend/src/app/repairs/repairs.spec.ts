import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Repairs } from './repairs';

describe('Repairs', () => {
  let component: Repairs;
  let fixture: ComponentFixture<Repairs>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Repairs],
    }).compileComponents();

    fixture = TestBed.createComponent(Repairs);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

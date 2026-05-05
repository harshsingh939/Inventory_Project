import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { AssetAssignmentsPanel } from './asset-assignments-panel';

describe('AssetAssignmentsPanel', () => {
  let component: AssetAssignmentsPanel;
  let fixture: ComponentFixture<AssetAssignmentsPanel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssetAssignmentsPanel, HttpClientTestingModule],
    }).compileComponents();

    fixture = TestBed.createComponent(AssetAssignmentsPanel);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('categorySlug', 'systems');
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('formatSessionDuration', () => {
    it('returns em dash for null/undefined/non-numeric', () => {
      expect(component.formatSessionDuration(null)).toBe('—');
      expect(component.formatSessionDuration(undefined)).toBe('—');
      expect(component.formatSessionDuration('')).toBe('—');
    });

    it('shows minutes only when under 24 hours', () => {
      expect(component.formatSessionDuration(63)).toBe('63 mins');
      expect(component.formatSessionDuration(1439)).toBe('1439 mins');
    });

    it('shows days (and remainder) from 24 hours up', () => {
      expect(component.formatSessionDuration(1440)).toBe('1 day');
      expect(component.formatSessionDuration(1446)).toBe('1 day 6 mins');
      expect(component.formatSessionDuration(1500)).toBe('1 day 1 hr');
      expect(component.formatSessionDuration(2880)).toBe('2 days');
    });
  });
});

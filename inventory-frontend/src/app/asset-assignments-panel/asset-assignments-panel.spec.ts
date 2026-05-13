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

  describe('history employee selection', () => {
    type PanelTest = AssetAssignmentsPanel & {
      rawAllAssignments: unknown[];
      users: unknown[];
    };

    it('shows no history rows until an employee is selected', () => {
      const c = component as unknown as PanelTest;
      c.rawAllAssignments = [
        { user_id: 1, user_name: 'A', employee_id: 'E1' },
        { user_id: 2, user_name: 'B', employee_id: 'E2' },
      ];
      component.historySelectedUserId = null;
      expect(component.historyRowsForView.length).toBe(0);
    });

    it('shows only the selected user’s assignments from raw data', () => {
      const c = component as unknown as PanelTest;
      c.rawAllAssignments = [
        { user_id: 1, user_name: 'Harsh', employee_id: 'EMP2611' },
        { user_id: 2, user_name: 'Other', employee_id: 'EMP999' },
        { user_id: 1, user_name: 'Harsh', employee_id: 'EMP2611' },
      ];
      component.historySelectedUserId = 1;
      expect(component.historyRowsForView.length).toBe(2);
    });

    it('sorts history rows by start_time descending (newest first)', () => {
      const c = component as unknown as PanelTest;
      c.rawAllAssignments = [
        { user_id: 1, start_time: '2020-01-01T12:00:00.000Z' },
        { user_id: 1, start_time: '2024-06-01T12:00:00.000Z' },
        { user_id: 1, start_time: '2022-01-01T12:00:00.000Z' },
      ];
      component.historySelectedUserId = 1;
      const view = component.historyRowsForView;
      expect(view.length).toBe(3);
      expect(view[0].start_time).toBe('2024-06-01T12:00:00.000Z');
      expect(view[2].start_time).toBe('2020-01-01T12:00:00.000Z');
    });

    it('historyEmployeesMatching filters users by name or employee_id', () => {
      const c = component as unknown as PanelTest;
      c.users = [
        { id: 1, name: 'Harsh Vradhan', employee_id: 'EMP2611', department: 'IT' },
        { id: 2, name: 'Other', employee_id: 'EMP999', department: 'HR' },
      ];
      component.historyPickerQuery = 'harsh';
      expect(component.historyEmployeesMatching().length).toBe(1);
      component.historyPickerQuery = '999';
      expect(component.historyEmployeesMatching().length).toBe(1);
    });
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AccountSettings } from './account-settings';

describe('AccountSettings', () => {
  let component: AccountSettings;
  let fixture: ComponentFixture<AccountSettings>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccountSettings],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(AccountSettings);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('nav[aria-label="Account settings sections"]'),
    ).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Account settings');
  }, 10_000);
});

import { useState } from 'react';

const YEARLY  = 49.99;
const MONTHLY = 12.99;
const PER_MO  = (YEARLY / 12).toFixed(2); // "4.17"

function getBillingDate() {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function NoPayment() {
  return (
    <div className="pw-no-payment">
      <CheckIcon />
      No Payment Due Now
    </div>
  );
}

/* ── Step 0: Value primer ── */
function Step0({ onNext }) {
  return (
    <div className="pw-body">
      <div className="pw-scroll">
        <h1 className="pw-headline">We want you to<br />try Unblur for free.</h1>

        <div className="pw-phone-wrap">
          <div className="pw-phone">
            <div className="pw-phone-notch" />
            <div className="pw-phone-screen">
              <div className="pw-mock-header">
                <span className="pw-mock-wm">Un<em>blur</em></span>
              </div>
              <div className="pw-mock-text">
                <ruby>国境<rt>こっきょう</rt></ruby>の
                <ruby>長<rt>なが</rt></ruby>い<br />
                トンネルを<ruby>抜<rt>ぬ</rt></ruby>けると<br />
                <span className="pw-mock-sel">
                  <ruby>雪国<rt>ゆきぐに</rt></ruby>
                </span>
                であった。
              </div>
              <div className="pw-mock-chip">
                <span className="pw-chip-word">雪国</span>
                <span className="pw-chip-sep">·</span>
                <span className="pw-chip-read">ゆきぐに</span>
                <span className="pw-chip-sep">·</span>
                <span className="pw-chip-meaning">snow country</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="pw-footer">
        <NoPayment />
        <button className="pw-cta" onClick={onNext}>Try for $0.00</button>
        <p className="pw-fine">3 days free, then ${YEARLY}/year (${PER_MO}/mo)</p>
      </div>
    </div>
  );
}

/* ── Step 1: Reminder primer ── */
function Step1({ onNext }) {
  return (
    <div className="pw-body pw-body--center">
      <div className="pw-scroll pw-scroll--center">
        <h1 className="pw-headline pw-headline--center">
          We'll send you<br />a reminder before<br />your free trial ends
        </h1>
        <div className="pw-bell-wrap">
          <svg className="pw-bell-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <div className="pw-bell-badge">1</div>
        </div>
      </div>

      <div className="pw-footer">
        <NoPayment />
        <button className="pw-cta" onClick={onNext}>Continue for FREE</button>
        <p className="pw-fine">Just ${YEARLY}/year (${PER_MO}/mo)</p>
      </div>
    </div>
  );
}

/* ── Step 2: Paywall ── */
function Step2({ plan, setPlan, billingDate, onNext }) {
  return (
    <div className="pw-body">
      <div className="pw-scroll">
        <h1 className="pw-headline">Start your 3-day FREE<br />trial to continue.</h1>

        {/* Timeline */}
        <div className="pw-timeline">
          <div className="pw-tl-row">
            <div className="pw-tl-track">
              <div className="pw-tl-dot pw-tl-dot--blue">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <div className="pw-tl-line pw-tl-line--blue" />
            </div>
            <div className="pw-tl-text">
              <strong>Today</strong>
              <span>Unlock unlimited scans, AI word explanations, furigana, and flashcards.</span>
            </div>
          </div>

          <div className="pw-tl-row">
            <div className="pw-tl-track">
              <div className="pw-tl-dot pw-tl-dot--blue">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </div>
              <div className="pw-tl-line pw-tl-line--gray" />
            </div>
            <div className="pw-tl-text">
              <strong>In 2 Days — Reminder</strong>
              <span>We'll send you a reminder that your trial is ending soon.</span>
            </div>
          </div>

          <div className="pw-tl-row">
            <div className="pw-tl-track">
              <div className="pw-tl-dot pw-tl-dot--dark">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </div>
            </div>
            <div className="pw-tl-text pw-tl-text--last">
              <strong>In 3 Days — Billing Starts</strong>
              <span>You'll be charged on {billingDate} unless you cancel anytime before.</span>
            </div>
          </div>
        </div>

        {/* Plan cards */}
        <div className="pw-plans">
          <button
            className={`pw-plan${plan === 'monthly' ? ' pw-plan--sel' : ''}`}
            onClick={() => setPlan('monthly')}
          >
            <div className="pw-plan-name">Monthly</div>
            <div className="pw-plan-price">
              ${MONTHLY}<span>/mo</span>
            </div>
            <div className={`pw-plan-radio${plan === 'monthly' ? ' pw-plan-radio--on' : ''}`} />
          </button>

          <button
            className={`pw-plan${plan === 'yearly' ? ' pw-plan--sel' : ''}`}
            onClick={() => setPlan('yearly')}
          >
            <div className={`pw-plan-badge${plan === 'yearly' ? '' : ' pw-plan-badge--dim'}`}>
              3 DAYS FREE
            </div>
            <div className="pw-plan-name">Yearly</div>
            <div className="pw-plan-price">
              ${PER_MO}<span>/mo</span>
            </div>
            <div className={`pw-plan-radio${plan === 'yearly' ? ' pw-plan-radio--on' : ''}`}>
              {plan === 'yearly' && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
          </button>
        </div>
      </div>

      <div className="pw-footer">
        <NoPayment />
        <button className="pw-cta" onClick={onNext}>Start My 3-Day Free Trial</button>
        <p className="pw-fine">
          {plan === 'yearly'
            ? `3 days free, then $${YEARLY} per year ($${PER_MO}/mo)`
            : `3 days free, then $${MONTHLY} per month`}
        </p>
      </div>
    </div>
  );
}

/* ── Root ── */
export default function PaywallScreen({ onDone }) {
  const [step, setStep]   = useState(0);
  const [plan, setPlan]   = useState('yearly');
  const billingDate       = getBillingDate();

  function back() { if (step > 0) setStep(s => s - 1); }
  function next() { if (step < 2) setStep(s => s + 1); else onDone(); }

  return (
    <div className="pw-root">
      <div className="pw-topbar">
        <button
          className={`pw-back${step === 0 ? ' pw-back--hidden' : ''}`}
          onClick={back}
          aria-label="Back"
        >
          ‹
        </button>
        <button className="pw-restore">Restore</button>
      </div>

      {step === 0 && <Step0 onNext={next} />}
      {step === 1 && <Step1 onNext={next} />}
      {step === 2 && <Step2 plan={plan} setPlan={setPlan} billingDate={billingDate} onNext={next} />}
    </div>
  );
}

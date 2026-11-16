// Privacy notice and terms of use. Plain data so the pages and the tests read the same text.
// Fill in the blanks in LEGAL (registration number, address, Information Officer) once confirmed;
// an empty value is simply left out of the page.

export const LEGAL = {
  company: 'Zeeder',
  product: 'Zeeder Finance OS',
  email: 'support@zeeder.ai',
  website: 'https://zeederfinanceos.com',
  registration: '',   // company registration number
  address: '',        // physical address
  officer: '',        // Information Officer's name
  updated: '16 November 2026',
  version: '2026-11-16',
}

export const REGULATOR = { name: 'the Information Regulator (South Africa)', url: 'https://inforegulator.org.za' }

export const PRIVACY = {
  title: 'Privacy notice',
  intro: `This notice explains how ${LEGAL.company} ("we", "us") collects, uses and protects personal information when you use ${LEGAL.product}. We follow the Protection of Personal Information Act, 2013 (POPIA).`,
  sections: [
    ['Who is responsible', [
      `${LEGAL.company} is the responsible party for the information you give us about yourself and your business account.`,
      `For information you upload about your own customers and suppliers (for example names, invoices and bank statement lines), you are the responsible party and we are your operator. We only process it to provide the service to you.`,
    ]],
    ['What we collect', [
      'Account details: your name, email address and password (stored only as a secure hash by our sign-in provider).',
      'Business details: business name, sector, location and number of staff.',
      'Financial information you choose to give us: bank statements, invoices, quotes, debtor and creditor lists, and the entries you record in your books.',
      'If you connect a mailbox to send invoices from, its sending details. The password is kept in an encrypted vault and is never shown again.',
      'Billing records: your plan, charge dates and amounts. Card details are entered on PayGate\'s secure page; we never see or store your card number.',
      'Basic technical data needed to run the service, such as sign-in sessions and error logs.',
    ]],
    ['Why we use it', [
      'To create your account, run the service and show you your numbers (performing our contract with you).',
      'To read your uploaded documents and answer your questions with artificial intelligence, only when you ask.',
      'To bill you and to keep the service secure and working.',
      'To contact you about your account. We do not sell your information and do not use it for advertising.',
    ]],
    ['Who we share it with', [
      'Supabase hosts our database and sign-in, in the European Union (Ireland).',
      'Vercel serves the website.',
      'Anthropic processes the text of the questions and documents you send to Zeeder AI, in the United States. It is used to answer you and is not used by us for anything else.',
      'PayGate processes subscription payments in South Africa.',
      'Resend delivers our own account and billing emails.',
      'Some of these providers are outside South Africa. We use providers that protect personal information to a standard that is comparable to POPIA, and we share only what each one needs.',
    ]],
    ['How we protect it', [
      'Everything is encrypted in transit. Each business\'s data is kept separate from every other business at database level.',
      'Access to production systems is limited to the people who need it.',
      'If something goes wrong with your information we will tell you and the Information Regulator as the law requires.',
    ]],
    ['How long we keep it', [
      'We keep your information while your account is active. When you delete your account, your workspace and its data are deleted. Billing records we must keep for tax and legal reasons are kept for the period the law requires.',
    ]],
    ['Your rights', [
      'You can ask us to confirm what we hold about you, to correct it, to delete it, or to stop processing it, and you can withdraw your consent at any time. You can delete your account yourself from the app, or email us.',
      `If you are unhappy with how we handle your information you can complain to ${REGULATOR.name} at ${REGULATOR.url}.`,
    ]],
    ['Cookies and similar storage', [
      'We use only what the service needs to work: your sign-in session and the last screen you viewed, kept in your browser. We do not use advertising or tracking cookies.',
    ]],
    ['Children', ['The service is for businesses and is not meant for anyone under 18.']],
    ['Changes', ['If we change this notice in a way that matters we will say so in the app. The date at the top shows the latest version.']],
  ],
}

export const TERMS = {
  title: 'Terms of use',
  intro: `These terms are the agreement between you and ${LEGAL.company} for ${LEGAL.product}. By creating an account you agree to them.`,
  sections: [
    ['The service', [
      `${LEGAL.product} helps small businesses see their cash, track what they are owed and owe, issue invoices and quotes, and prepare financial statements from the information they give us.`,
      'Which features you get depends on your pack: Starter, Growth or Pro. The packs and what they include are shown on our website and in the app.',
    ]],
    ['Free trial, prices and payment', [
      'New accounts start with a 14-day free trial. No credit card is needed to start.',
      'Prices are in South African rand a month. Where VAT applies it is shown on your invoice. Subscriptions are charged monthly by card through PayGate until you cancel.',
      'You can cancel at any time in the app. Cancelling stops future charges and you keep access until the end of the period you have paid for.',
    ]],
    ['Your information and your responsibilities', [
      'You own your information. You give us permission to process it to provide the service.',
      'You are responsible for the accuracy of what you upload and record, for keeping your password safe, and for having the right to use the information of your customers and suppliers.',
      'You must not misuse the service, try to break its security, or use it for anything unlawful.',
    ]],
    ['Not professional advice', [
      `${LEGAL.product} produces reports, estimates and AI answers to help you. They are not accounting, tax, legal or financial advice. The income tax figure is an estimate and is never filed with SARS. Artificial intelligence can make mistakes, so check anything important with your accountant before you act on it.`,
    ]],
    ['Availability and changes', [
      'We work to keep the service running but cannot promise it will always be available or error free. We may improve, change or retire features, and we will give notice of changes that matter.',
    ]],
    ['Limits on our responsibility', [
      'To the extent the law allows, we are not liable for indirect or consequential loss, or for loss caused by information you gave us being wrong, by AI answers, or by events outside our control. Our total liability for any claim is limited to the amount you paid us in the three months before the claim.',
      'Nothing in these terms limits any right you have under the Consumer Protection Act or other law that cannot be limited.',
    ]],
    ['Ending the agreement', [
      'You can stop using the service and delete your account at any time. We may suspend or end an account that breaks these terms or is not paid, and we will tell you why.',
    ]],
    ['General', [
      'South African law applies, and the South African courts have jurisdiction. If part of these terms cannot be enforced, the rest still applies. We may update these terms and will tell you in the app about changes that matter.',
    ]],
  ],
}

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const config = window.TABAJA_CLINIC_CONFIG;

if (!config?.supabaseUrl || !config?.publishableKey) {
  throw new Error('Clinic cloud configuration is missing.');
}

const supabase = createClient(
  config.supabaseUrl,
  config.publishableKey
);

window.TABAJA_CLINIC_SUPABASE = supabase;

const signinForm = document.getElementById('signinForm');
const companyForm = document.getElementById('companyForm');
const systemMessage = document.getElementById('systemMessage');
const forgotPasswordLink = document.getElementById('forgotPasswordLink');

const SITE_URL =
  `${window.location.origin}${window.location.pathname.replace(/[^/]*$/, '')}`;

function showMessage(message, type = 'success') {
  if (!systemMessage) return;

  systemMessage.textContent = message;
  systemMessage.className = `system-message show ${type}`;
}

function clearMessage() {
  if (!systemMessage) return;

  systemMessage.textContent = '';
  systemMessage.className = 'system-message';
}

function setFormBusy(form, busy) {
  if (!form) return;

  form.querySelectorAll('input, select, button').forEach(element => {
    element.disabled = busy;
  });
}

async function isPlatformAdmin() {
  const { data, error } = await supabase.rpc('is_platform_admin');

  if (error) {
    console.error('Admin check failed:', error);
    return false;
  }

  return data === true;
}

async function provisionCompany() {
  const { data, error } = await supabase.rpc(
    'provision_company_from_signup'
  );

  if (error) {
    throw error;
  }

  return data;
}

async function loadCompany(companyId) {
  if (!companyId) return null;

  const { data, error } = await supabase
    .from('companies')
    .select(`
      id,
      name,
      status,
      subscription_status,
      plan_code,
      seat_limit,
      trial_started_at,
      trial_ends_at
    `)
    .eq('id', companyId)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function completeSignedInSetup() {
  const admin = await isPlatformAdmin();

  if (admin) {
    showMessage(
      'Platform Admin signed in successfully.',
      'success'
    );

    return {
      type: 'platform_admin'
    };
  }

  const companyId = await provisionCompany();
  const company = await loadCompany(companyId);

  showMessage(
    `Welcome to ${company?.name || 'your clinic workspace'}.`,
    'success'
  );

  return {
    type: 'company',
    company
  };
}

signinForm?.addEventListener('submit', async event => {
  event.preventDefault();
  clearMessage();
  setFormBusy(signinForm, true);

  try {
    const email =
      document.getElementById('signinEmail').value.trim();

    const password =
      document.getElementById('signinPassword').value;

    const { data, error } =
      await supabase.auth.signInWithPassword({
        email,
        password
      });

    if (error) {
      throw error;
    }

    if (!data?.user) {
      throw new Error('Unable to sign in.');
    }

    await completeSignedInSetup();

  } catch (error) {
    console.error('Sign in failed:', error);

    showMessage(
      error?.message || 'Sign in failed.',
      'error'
    );

  } finally {
    setFormBusy(signinForm, false);
  }
});

companyForm?.addEventListener('submit', async event => {
  event.preventDefault();
  clearMessage();
  setFormBusy(companyForm, true);

  try {
    const companyName =
      document.getElementById('companyName').value.trim();

    const ownerName =
      document.getElementById('ownerName').value.trim();

    const country =
      document.getElementById('country').value.trim();

    const phone =
      document.getElementById('phone').value.trim();

    const specialtyCode =
      document.getElementById('specialty').value;

    const email =
      document.getElementById('companyEmail').value.trim();

    const password =
      document.getElementById('companyPassword').value;

    if (!companyName) {
      throw new Error('Clinic / Company name is required.');
    }

    if (!ownerName) {
      throw new Error('Owner name is required.');
    }

    if (!specialtyCode) {
      throw new Error('Please select a medical specialty.');
    }

    const { data, error } =
      await supabase.auth.signUp({
        email,
        password,

        options: {
          emailRedirectTo: SITE_URL,

          data: {
            company_name: companyName,
            owner_name: ownerName,
            full_name: ownerName,
            country,
            phone,
            specialty_code: specialtyCode
          }
        }
      });

    if (error) {
      throw error;
    }

    if (data?.session) {
      await completeSignedInSetup();

      showMessage(
        'Company account created successfully.',
        'success'
      );

      return;
    }

    showMessage(
      'Company account created. Please check your email and confirm your account before signing in.',
      'success'
    );

    companyForm.reset();

  } catch (error) {
    console.error('Company signup failed:', error);

    showMessage(
      error?.message || 'Unable to create company account.',
      'error'
    );

  } finally {
    setFormBusy(companyForm, false);
  }
});

forgotPasswordLink?.addEventListener('click', event => {
  event.preventDefault();

  showMessage(
    'Password recovery will be enabled in the next account-security step.',
    'success'
  );
});

async function restoreExistingSession() {
  try {
    const { data, error } =
      await supabase.auth.getSession();

    if (error) {
      throw error;
    }

    if (!data?.session?.user) {
      return;
    }

    await completeSignedInSetup();

  } catch (error) {
    console.error('Session restore failed:', error);
  }
}

restoreExistingSession();

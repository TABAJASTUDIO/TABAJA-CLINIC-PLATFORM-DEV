import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const config = window.TABAJA_CLINIC_CONFIG;

if (!config?.supabaseUrl || !config?.publishableKey) {
  throw new Error('Tabaja Clinic cloud configuration is missing.');
}

const supabase = createClient(config.supabaseUrl, config.publishableKey);
window.TABAJA_CLINIC_SUPABASE = supabase;

const signinForm = document.getElementById('signinForm');
const signinEmail = document.getElementById('signinEmail');
const signinPassword = document.getElementById('signinPassword');
const forgotPasswordLink = document.getElementById('forgotPasswordLink');
const systemMessage = document.getElementById('systemMessage');

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

function setBusy(isBusy) {
  if (!signinForm) return;

  const button = signinForm.querySelector('button[type="submit"]');

  if (!button) return;

  button.disabled = isBusy;
  button.style.opacity = isBusy ? '0.72' : '';
  button.style.cursor = isBusy ? 'wait' : '';
}

async function isPlatformAdmin() {
  const { data, error } = await supabase.rpc('is_platform_admin');

  if (error) {
    throw error;
  }

  return data === true;
}

async function provisionClinicWorkspace() {
  const { data, error } = await supabase.rpc(
    'provision_company_from_signup'
  );

  if (error) {
    throw error;
  }

  return data;
}

async function routeSignedInUser() {
  const admin = await isPlatformAdmin();

  if (admin) {
    window.location.replace('./admin.html');
    return;
  }

  await provisionClinicWorkspace();

  window.location.replace('./workspace.html');
}

signinForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  clearMessage();
  setBusy(true);

  try {
    const email = signinEmail?.value?.trim();
    const password = signinPassword?.value || '';

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      throw error;
    }

    showMessage(
      'Signed in successfully. Opening your workspace...',
      'success'
    );

    await routeSignedInUser();
  } catch (error) {
    showMessage(
      error?.message || 'Unable to sign in.',
      'error'
    );
  } finally {
    setBusy(false);
  }
});

forgotPasswordLink?.addEventListener('click', (event) => {
  event.preventDefault();

  showMessage(
    'Password recovery will be connected in the next security step.',
    'success'
  );
});

async function restoreExistingSession() {
  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      throw error;
    }

    if (data?.session) {
      await routeSignedInUser();
    }
  } catch (error) {
    showMessage(
      error?.message || 'Unable to restore your session.',
      'error'
    );
  }
}

restoreExistingSession();

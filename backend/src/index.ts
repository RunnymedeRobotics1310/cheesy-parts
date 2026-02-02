/**
 * Cheesy Parts API - Cloudflare Workers
 *
 * Hono-based API for the parts management system.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

type Bindings = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  AUTH_SECRET: string;
  RESEND_API_KEY?: string;
  ADMIN_EMAIL?: string; // Email to receive admin notifications
  FRONTEND_URL?: string; // Frontend URL for CORS (defaults to localhost in dev)
  LOGIN_RATE_LIMITER?: RateLimit; // Cloudflare Rate Limiting binding
};

// Cloudflare Rate Limiting binding type
interface RateLimit {
  limit: (options: { key: string }) => Promise<{ success: boolean }>;
}

// User permission levels
type Permission = 'readonly' | 'editor' | 'admin';

// Token data returned from verification
interface TokenData {
  valid: boolean;
  userId?: string;
  permission?: Permission;
}

// Token validity period: 14 days in milliseconds
const TOKEN_VALIDITY_MS = 14 * 24 * 60 * 60 * 1000;

// PBKDF2 password hashing
// Cloudflare Workers limits iterations to 100,000 max
async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  return Array.from(new Uint8Array(derivedBits))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Generate a random salt
function generateSalt(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Password validation - returns error message or null if valid
function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(password)) return 'Password must contain an uppercase letter';
  if (!/[a-z]/.test(password)) return 'Password must contain a lowercase letter';
  if (!/[0-9]/.test(password)) return 'Password must contain a number';
  return null;
}

// Parse and validate positive currency values
function parsePositiveCurrency(value: any): number {
  const num = parseFloat(String(value).replace(/[$,]/g, ''));
  if (isNaN(num) || num < 0) return 0;
  if (num > 1000000) return 1000000; // Reasonable upper limit
  return Math.round(num * 100) / 100; // Round to cents
}

// HMAC-based token generation
async function generateToken(
  secret: string,
  userId: string,
  permission: Permission
): Promise<string> {
  const expiresAt = Date.now() + TOKEN_VALIDITY_MS;
  const payload = `cheesy_parts:${userId}:${permission}:${expiresAt}`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const signatureHex = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return btoa(`${payload}:${signatureHex}`);
}

// HMAC-based token verification
async function verifyToken(token: string, secret: string): Promise<TokenData> {
  try {
    const decoded = atob(token);
    const parts = decoded.split(':');

    if (parts.length !== 5 || parts[0] !== 'cheesy_parts') {
      return { valid: false };
    }

    const [, userId, permission, expiresAtStr, signatureHex] = parts;
    const expiresAt = parseInt(expiresAtStr, 10);

    if (isNaN(expiresAt) || Date.now() > expiresAt) {
      return { valid: false };
    }

    const payload = `cheesy_parts:${userId}:${permission}:${expiresAtStr}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signatureBytes = new Uint8Array(
      signatureHex.match(/.{2}/g)!.map(byte => parseInt(byte, 16))
    );

    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes,
      encoder.encode(payload)
    );

    if (isValid) {
      return { valid: true, userId, permission: permission as Permission };
    }
    return { valid: false };
  } catch {
    return { valid: false };
  }
}

// Context variables for authenticated user
type Variables = {
  userId: string;
  permission: Permission;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Security headers middleware
app.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('X-XSS-Protection', '0'); // Disabled as per modern best practices
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
});

// CORS middleware with configurable origin
app.use('*', async (c, next) => {
  const frontendUrl = c.env.FRONTEND_URL || 'http://localhost:5173';
  return cors({
    origin: [frontendUrl],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  })(c, next);
});

// Auth middleware - protect routes based on method
app.use('*', async (c, next) => {
  const method = c.req.method;
  const path = c.req.path;

  // Allow auth endpoints and health check without token
  if (path.startsWith('/auth/') || path === '/health') {
    return next();
  }

  // Check for auth token
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const tokenData = await verifyToken(token, c.env.AUTH_SECRET);
  if (!tokenData.valid || !tokenData.userId || !tokenData.permission) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  c.set('userId', tokenData.userId);
  c.set('permission', tokenData.permission);

  return next();
});

// Helper to create Supabase client from env
function getSupabase(env: Bindings): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Permission check helpers
function canEdit(permission: Permission): boolean {
  return permission === 'editor' || permission === 'admin';
}

function canAdmin(permission: Permission): boolean {
  return permission === 'admin';
}

// ============================================
// EMAIL NOTIFICATION FUNCTIONS
// ============================================

async function sendEmail(
  env: Bindings,
  to: string,
  subject: string,
  html: string
): Promise<boolean> {
  if (!env.RESEND_API_KEY) {
    console.log('RESEND_API_KEY not configured, skipping email');
    return false;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Cheesy Parts <noreply@calendar.team1310.ca>',
        to: [to],
        subject,
        html,
      }),
    });

    if (response.ok) {
      console.log(`Email sent to ${to}`);
      return true;
    } else {
      const errorData = await response.json();
      console.error(`Failed to send email to ${to}:`, errorData);
      return false;
    }
  } catch (err) {
    console.error(`Error sending email to ${to}:`, err);
    return false;
  }
}

function buildRegistrationEmailHtml(firstName: string, lastName: string, email: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
    .info { background: white; padding: 15px; border-radius: 4px; margin: 15px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0;">New User Registration</h2>
    </div>
    <div class="content">
      <p>A new user has registered for Cheesy Parts and is awaiting approval:</p>
      <div class="info">
        <p><strong>Name:</strong> ${firstName} ${lastName}</p>
        <p><strong>Email:</strong> ${email}</p>
      </div>
      <p>Please log in to the admin panel to approve or reject this registration.</p>
    </div>
  </div>
</body>
</html>`;
}

function buildApprovalEmailHtml(firstName: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #16a34a; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0;">Account Approved!</h2>
    </div>
    <div class="content">
      <p>Hi ${firstName},</p>
      <p>Your Cheesy Parts account has been approved! You can now log in and start using the system.</p>
      <p>Welcome to the team!</p>
    </div>
  </div>
</body>
</html>`;
}

// ============================================
// HEALTH CHECK
// ============================================

app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    runtime: 'cloudflare-workers',
    timestamp: new Date().toISOString(),
  });
});

// ============================================
// AUTH ENDPOINTS
// ============================================

app.post('/auth/login', async (c) => {
  try {
    // Rate limiting check using Cloudflare binding if available
    if (c.env.LOGIN_RATE_LIMITER) {
      const clientIp = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
      const { success } = await c.env.LOGIN_RATE_LIMITER.limit({ key: clientIp });
      if (!success) {
        return c.json({ error: 'Too many login attempts. Please try again later.' }, 429);
      }
    }

    const body = await c.req.json();
    const { email, password } = body;

    if (!email || !password) {
      return c.json({ error: 'Email and password required' }, 400);
    }

    const supabase = getSupabase(c.env);
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, password_hash, salt, first_name, last_name, permission, enabled')
      .eq('email', email.toLowerCase())
      .single();

    if (error || !user) {
      return c.json({ error: 'Invalid email or password' }, 401);
    }

    if (!user.enabled) {
      return c.json({ error: 'Account is disabled' }, 403);
    }

    const hash = await hashPassword(password, user.salt);
    if (hash !== user.password_hash) {
      return c.json({ error: 'Invalid email or password' }, 401);
    }

    const token = await generateToken(c.env.AUTH_SECRET, user.id, user.permission);

    return c.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        permission: user.permission,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error.message);
    return c.json({ error: 'Login failed' }, 500);
  }
});

app.post('/auth/register', async (c) => {
  try {
    const body = await c.req.json();
    const { email, password, firstName, lastName } = body;

    if (!email || !password || !firstName || !lastName) {
      return c.json({ error: 'All fields required' }, 400);
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return c.json({ error: 'Invalid email format' }, 400);
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return c.json({ error: passwordError }, 400);
    }

    const supabase = getSupabase(c.env);

    // Check if email already exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existing) {
      return c.json({ error: 'Email already registered' }, 409);
    }

    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);

    // New users are disabled by default, pending admin approval
    const { data: user, error } = await supabase
      .from('users')
      .insert({
        email: email.toLowerCase(),
        password_hash: passwordHash,
        salt,
        first_name: firstName,
        last_name: lastName,
        permission: 'readonly',
        enabled: false,
      })
      .select('id, email, first_name, last_name')
      .single();

    if (error) throw error;

    // Send admin notification email
    if (c.env.ADMIN_EMAIL) {
      await sendEmail(
        c.env,
        c.env.ADMIN_EMAIL,
        'New Cheesy Parts Registration',
        buildRegistrationEmailHtml(firstName, lastName, email)
      );
    }

    return c.json({
      message: 'Registration successful. Your account is pending approval.',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
      },
    }, 201);
  } catch (error: any) {
    console.error('Registration error:', error.message);
    return c.json({ error: 'Registration failed' }, 500);
  }
});

app.get('/auth/me', async (c) => {
  try {
    const userId = c.get('userId');
    const supabase = getSupabase(c.env);

    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, permission')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      permission: user.permission,
    });
  } catch (error: any) {
    console.error('Get me error:', error.message);
    return c.json({ error: 'Failed to get user' }, 500);
  }
});

app.post('/auth/change-password', async (c) => {
  try {
    const userId = c.get('userId');
    const body = await c.req.json();
    const { oldPassword, newPassword } = body;

    if (!oldPassword || !newPassword) {
      return c.json({ error: 'Old and new password required' }, 400);
    }

    const supabase = getSupabase(c.env);

    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('password_hash, salt')
      .eq('id', userId)
      .single();

    if (fetchError || !user) {
      return c.json({ error: 'User not found' }, 404);
    }

    const oldHash = await hashPassword(oldPassword, user.salt);
    if (oldHash !== user.password_hash) {
      return c.json({ error: 'Invalid old password' }, 401);
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return c.json({ error: passwordError }, 400);
    }

    const newSalt = generateSalt();
    const newHash = await hashPassword(newPassword, newSalt);

    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: newHash, salt: newSalt })
      .eq('id', userId);

    if (updateError) throw updateError;

    return c.json({ message: 'Password changed successfully' });
  } catch (error: any) {
    console.error('Change password error:', error.message);
    return c.json({ error: 'Failed to change password' }, 500);
  }
});

// ============================================
// USERS ENDPOINTS (Admin only)
// ============================================

app.get('/users', async (c) => {
  try {
    const permission = c.get('permission');
    if (!canAdmin(permission)) {
      return c.json({ error: 'Admin access required' }, 403);
    }

    const supabase = getSupabase(c.env);
    const { data, error } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, permission, enabled, created_at')
      .order('last_name')
      .order('first_name');

    if (error) throw error;

    // Transform to camelCase for frontend
    const users = (data || []).map((u: any) => ({
      id: u.id,
      email: u.email,
      firstName: u.first_name,
      lastName: u.last_name,
      permission: u.permission,
      enabled: u.enabled,
      createdAt: u.created_at,
    }));

    return c.json(users);
  } catch (error: any) {
    console.error('Get users error:', error.message);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
});

app.get('/users/:id', async (c) => {
  try {
    const permission = c.get('permission');
    if (!canAdmin(permission)) {
      return c.json({ error: 'Admin access required' }, 403);
    }

    const supabase = getSupabase(c.env);
    const { data, error } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, permission, enabled, created_at')
      .eq('id', c.req.param('id'))
      .single();

    if (error) throw error;

    // Transform to camelCase for frontend
    return c.json({
      id: data.id,
      email: data.email,
      firstName: data.first_name,
      lastName: data.last_name,
      permission: data.permission,
      enabled: data.enabled,
      createdAt: data.created_at,
    });
  } catch (error: any) {
    console.error('Get user error:', error.message);
    return c.json({ error: 'User not found' }, 404);
  }
});

app.post('/users', async (c) => {
  try {
    const permission = c.get('permission');
    if (!canAdmin(permission)) {
      return c.json({ error: 'Admin access required' }, 403);
    }

    const body = await c.req.json();
    const { email, password, firstName, lastName, userPermission, enabled } = body;

    if (!email || !password || !firstName || !lastName || !userPermission) {
      return c.json({ error: 'All fields required' }, 400);
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return c.json({ error: passwordError }, 400);
    }

    const supabase = getSupabase(c.env);

    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);

    const { data, error } = await supabase
      .from('users')
      .insert({
        email: email.toLowerCase(),
        password_hash: passwordHash,
        salt,
        first_name: firstName,
        last_name: lastName,
        permission: userPermission,
        enabled: enabled ?? true,
      })
      .select('id, email, first_name, last_name, permission, enabled')
      .single();

    if (error) throw error;

    // Transform to camelCase for frontend
    return c.json({
      id: data.id,
      email: data.email,
      firstName: data.first_name,
      lastName: data.last_name,
      permission: data.permission,
      enabled: data.enabled,
    }, 201);
  } catch (error: any) {
    console.error('Create user error:', error.message);
    return c.json({ error: error.message }, 400);
  }
});

app.put('/users/:id', async (c) => {
  try {
    const permission = c.get('permission');
    if (!canAdmin(permission)) {
      return c.json({ error: 'Admin access required' }, 403);
    }

    const body = await c.req.json();
    const supabase = getSupabase(c.env);
    const userId = c.req.param('id');

    // Get current user state to check if we're enabling them
    const { data: currentUser } = await supabase
      .from('users')
      .select('enabled, email, first_name')
      .eq('id', userId)
      .single();

    const wasDisabled = currentUser && !currentUser.enabled;
    const willBeEnabled = body.enabled === true;

    const updateData: Record<string, any> = {};
    if (body.email) updateData.email = body.email.toLowerCase();
    if (body.firstName) updateData.first_name = body.firstName;
    if (body.lastName) updateData.last_name = body.lastName;
    if (body.permission) updateData.permission = body.permission;
    if (typeof body.enabled === 'boolean') updateData.enabled = body.enabled;

    // Handle password change
    if (body.password) {
      const passwordError = validatePassword(body.password);
      if (passwordError) {
        return c.json({ error: passwordError }, 400);
      }
      const salt = generateSalt();
      updateData.salt = salt;
      updateData.password_hash = await hashPassword(body.password, salt);
    }

    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select('id, email, first_name, last_name, permission, enabled')
      .single();

    if (error) throw error;

    // Send approval email if user was just enabled
    if (wasDisabled && willBeEnabled && currentUser) {
      await sendEmail(
        c.env,
        currentUser.email,
        'Your Cheesy Parts Account Has Been Approved',
        buildApprovalEmailHtml(currentUser.first_name)
      );
    }

    // Transform to camelCase for frontend
    return c.json({
      id: data.id,
      email: data.email,
      firstName: data.first_name,
      lastName: data.last_name,
      permission: data.permission,
      enabled: data.enabled,
    });
  } catch (error: any) {
    console.error('Update user error:', error.message);
    return c.json({ error: error.message }, 400);
  }
});

app.delete('/users/:id', async (c) => {
  try {
    const permission = c.get('permission');
    if (!canAdmin(permission)) {
      return c.json({ error: 'Admin access required' }, 403);
    }

    const supabase = getSupabase(c.env);
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', c.req.param('id'));

    if (error) throw error;
    return c.body(null, 204);
  } catch (error: any) {
    console.error('Delete user error:', error.message);
    return c.json({ error: error.message }, 400);
  }
});

// ============================================
// PROJECTS ENDPOINTS
// ============================================

app.get('/projects', async (c) => {
  try {
    const supabase = getSupabase(c.env);
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('name');

    if (error) throw error;
    return c.json(data);
  } catch (error: any) {
    console.error('Get projects error:', error.message);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
});

app.get('/projects/:id', async (c) => {
  try {
    const supabase = getSupabase(c.env);
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', c.req.param('id'))
      .single();

    if (error) throw error;
    return c.json(data);
  } catch (error: any) {
    console.error('Get project error:', error.message);
    return c.json({ error: 'Project not found' }, 404);
  }
});

app.post('/projects', async (c) => {
  try {
    const permission = c.get('permission');
    if (!canEdit(permission)) {
      return c.json({ error: 'Editor access required' }, 403);
    }

    const body = await c.req.json();
    const { name, partNumberPrefix } = body;

    if (!name || !partNumberPrefix) {
      return c.json({ error: 'Name and part number prefix required' }, 400);
    }

    const supabase = getSupabase(c.env);
    const { data, error } = await supabase
      .from('projects')
      .insert({
        name,
        part_number_prefix: partNumberPrefix,
        hide_dashboards: false,
      })
      .select()
      .single();

    if (error) throw error;
    return c.json(data, 201);
  } catch (error: any) {
    console.error('Create project error:', error.message);
    return c.json({ error: error.message }, 400);
  }
});

app.put('/projects/:id', async (c) => {
  try {
    const permission = c.get('permission');
    if (!canEdit(permission)) {
      return c.json({ error: 'Editor access required' }, 403);
    }

    const body = await c.req.json();
    const supabase = getSupabase(c.env);

    const updateData: Record<string, any> = {};
    if (body.name) updateData.name = body.name;
    if (body.partNumberPrefix) updateData.part_number_prefix = body.partNumberPrefix;
    if (typeof body.hideDashboards === 'boolean') updateData.hide_dashboards = body.hideDashboards;

    const { data, error } = await supabase
      .from('projects')
      .update(updateData)
      .eq('id', c.req.param('id'))
      .select()
      .single();

    if (error) throw error;
    return c.json(data);
  } catch (error: any) {
    console.error('Update project error:', error.message);
    return c.json({ error: error.message }, 400);
  }
});

app.delete('/projects/:id', async (c) => {
  try {
    const permission = c.get('permission');
    if (!canEdit(permission)) {
      return c.json({ error: 'Editor access required' }, 403);
    }

    const supabase = getSupabase(c.env);
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', c.req.param('id'));

    if (error) throw error;
    return c.body(null, 204);
  } catch (error: any) {
    console.error('Delete project error:', error.message);
    return c.json({ error: error.message }, 400);
  }
});

// ============================================
// PARTS ENDPOINTS
// ============================================

// Part status and priority maps (matching original)
const PART_STATUS_MAP: Record<string, string> = {
  designing: 'Design in progress',
  material: 'Material needs to be ordered',
  ordered: 'Waiting for materials',
  drawing: 'Needs drawing',
  ready: 'Ready to manufacture',
  cnc: 'Ready for CNC',
  laser: 'Ready for laser',
  lathe: 'Ready for lathe',
  mill: 'Ready for mill',
  printer: 'Ready for 3D printer',
  router: 'Ready for router',
  manufacturing: 'Manufacturing in progress',
  outsourced: 'Waiting for outsourced manufacturing',
  welding: 'Waiting for welding',
  scotchbrite: 'Waiting for Scotch-Brite',
  anodize: 'Ready for anodize',
  powder: 'Ready for powder coating',
  coating: 'Waiting for coating',
  assembly: 'Waiting for assembly',
  done: 'Done',
};

const PART_STATUSES = Object.keys(PART_STATUS_MAP);

app.get('/projects/:projectId/parts', async (c) => {
  try {
    const supabase = getSupabase(c.env);
    const projectId = c.req.param('projectId');
    const sort = c.req.query('sort') || 'part_number';

    let query = supabase
      .from('parts')
      .select('*')
      .eq('project_id', projectId);

    // Handle sorting
    if (sort === 'type' || sort === 'name' || sort === 'status') {
      query = query.order(sort);
    } else {
      query = query.order('part_number');
    }

    const { data, error } = await query;
    if (error) throw error;
    return c.json(data);
  } catch (error: any) {
    console.error('Get parts error:', error.message);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
});

app.get('/parts/:id', async (c) => {
  try {
    const supabase = getSupabase(c.env);
    const { data, error } = await supabase
      .from('parts')
      .select('*, project:projects(*)')
      .eq('id', c.req.param('id'))
      .single();

    if (error) throw error;
    return c.json(data);
  } catch (error: any) {
    console.error('Get part error:', error.message);
    return c.json({ error: 'Part not found' }, 404);
  }
});

app.post('/projects/:projectId/parts', async (c) => {
  try {
    const permission = c.get('permission');
    if (!canEdit(permission)) {
      return c.json({ error: 'Editor access required' }, 403);
    }

    const body = await c.req.json();
    const projectId = c.req.param('projectId');
    const { type, name, parentPartId } = body;

    if (!type || !name) {
      return c.json({ error: 'Type and name required' }, 400);
    }

    if (!['part', 'assembly'].includes(type)) {
      return c.json({ error: 'Invalid part type' }, 400);
    }

    const supabase = getSupabase(c.env);

    // Generate part number following original logic
    let partNumber: number;
    const parentId = parentPartId || null;

    if (type === 'part') {
      // For parts: find max part number under the same parent, or parent's number if no siblings
      const { data: siblings } = await supabase
        .from('parts')
        .select('part_number')
        .eq('project_id', projectId)
        .eq('parent_part_id', parentId)
        .eq('type', 'part')
        .order('part_number', { ascending: false })
        .limit(1);

      if (siblings && siblings.length > 0) {
        partNumber = siblings[0].part_number + 1;
      } else if (parentId) {
        // Get parent's part number
        const { data: parent } = await supabase
          .from('parts')
          .select('part_number')
          .eq('id', parentId)
          .single();
        partNumber = (parent?.part_number || 0) + 1;
      } else {
        partNumber = 1;
      }
    } else {
      // For assemblies: increment by 100 from highest assembly number
      const { data: assemblies } = await supabase
        .from('parts')
        .select('part_number')
        .eq('project_id', projectId)
        .eq('type', 'assembly')
        .order('part_number', { ascending: false })
        .limit(1);

      partNumber = assemblies && assemblies.length > 0
        ? assemblies[0].part_number + 100
        : 100;
    }

    const { data, error } = await supabase
      .from('parts')
      .insert({
        project_id: projectId,
        part_number: partNumber,
        type,
        name: name.replace(/"/g, '&quot;'),
        parent_part_id: parentId,
        status: 'designing',
        source_material: '',
        have_material: false,
        quantity: '',
        cut_length: '',
        priority: 1,
        drawing_created: false,
        notes: '',
      })
      .select()
      .single();

    if (error) throw error;
    return c.json(data, 201);
  } catch (error: any) {
    console.error('Create part error:', error.message);
    return c.json({ error: error.message }, 400);
  }
});

app.put('/parts/:id', async (c) => {
  try {
    const permission = c.get('permission');
    if (!canEdit(permission)) {
      return c.json({ error: 'Editor access required' }, 403);
    }

    const body = await c.req.json();
    const supabase = getSupabase(c.env);

    const updateData: Record<string, any> = {};
    if (body.name) updateData.name = body.name.replace(/"/g, '&quot;');
    if (body.status) {
      if (!PART_STATUSES.includes(body.status)) {
        return c.json({ error: 'Invalid status' }, 400);
      }
      updateData.status = body.status;
    }
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.sourceMaterial !== undefined) updateData.source_material = body.sourceMaterial;
    if (typeof body.haveMaterial === 'boolean') updateData.have_material = body.haveMaterial;
    if (body.quantity !== undefined) updateData.quantity = body.quantity;
    if (body.cutLength !== undefined) updateData.cut_length = body.cutLength;
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (typeof body.drawingCreated === 'boolean') updateData.drawing_created = body.drawingCreated;

    const { data, error } = await supabase
      .from('parts')
      .update(updateData)
      .eq('id', c.req.param('id'))
      .select()
      .single();

    if (error) throw error;
    return c.json(data);
  } catch (error: any) {
    console.error('Update part error:', error.message);
    return c.json({ error: error.message }, 400);
  }
});

// Quick status update endpoint
app.patch('/parts/:id/status', async (c) => {
  try {
    const permission = c.get('permission');
    if (!canEdit(permission)) {
      return c.json({ error: 'Editor access required' }, 403);
    }

    const body = await c.req.json();
    const { status } = body;

    if (!status || !PART_STATUSES.includes(status)) {
      return c.json({ error: 'Invalid status' }, 400);
    }

    const supabase = getSupabase(c.env);
    const { data, error } = await supabase
      .from('parts')
      .update({ status })
      .eq('id', c.req.param('id'))
      .select()
      .single();

    if (error) throw error;
    return c.json(data);
  } catch (error: any) {
    console.error('Update status error:', error.message);
    return c.json({ error: error.message }, 400);
  }
});

app.delete('/parts/:id', async (c) => {
  try {
    const permission = c.get('permission');
    if (!canEdit(permission)) {
      return c.json({ error: 'Editor access required' }, 403);
    }

    const supabase = getSupabase(c.env);
    const partId = c.req.param('id');

    // Check for child parts
    const { data: children } = await supabase
      .from('parts')
      .select('id')
      .eq('parent_part_id', partId)
      .limit(1);

    if (children && children.length > 0) {
      return c.json({ error: "Can't delete assembly with existing children" }, 400);
    }

    const { error } = await supabase
      .from('parts')
      .delete()
      .eq('id', partId);

    if (error) throw error;
    return c.body(null, 204);
  } catch (error: any) {
    console.error('Delete part error:', error.message);
    return c.json({ error: error.message }, 400);
  }
});

// ============================================
// DASHBOARD ENDPOINT
// ============================================

app.get('/projects/:projectId/dashboard', async (c) => {
  try {
    const supabase = getSupabase(c.env);
    const projectId = c.req.param('projectId');
    const status = c.req.query('status');

    let query = supabase
      .from('parts')
      .select('*')
      .eq('project_id', projectId)
      .neq('status', 'done');

    if (status && PART_STATUSES.includes(status)) {
      query = query.eq('status', status);
    }

    const { data: parts, error } = await query.order('priority').order('part_number');

    if (error) throw error;

    // Get project info
    const { data: project } = await supabase
      .from('projects')
      .select('name, part_number_prefix')
      .eq('id', projectId)
      .single();

    // Group parts by status
    const partsByStatus: Record<string, any[]> = {};
    for (const s of PART_STATUSES) {
      partsByStatus[s] = [];
    }
    for (const part of parts || []) {
      if (partsByStatus[part.status]) {
        partsByStatus[part.status].push(part);
      }
    }

    return c.json({
      project,
      partsByStatus,
      statusMap: PART_STATUS_MAP,
      totalParts: parts?.length || 0,
    });
  } catch (error: any) {
    console.error('Get dashboard error:', error.message);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
});

// ============================================
// ORDERS ENDPOINTS
// ============================================

app.get('/projects/:projectId/orders', async (c) => {
  try {
    const supabase = getSupabase(c.env);
    const projectId = c.req.param('projectId');
    const status = c.req.query('status');

    let query = supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('project_id', projectId)
      .order('vendor_name')
      .order('ordered_at');

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return c.json(data);
  } catch (error: any) {
    console.error('Get orders error:', error.message);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
});

// All orders with optional vendor/purchaser filter
app.get('/projects/:projectId/orders/all', async (c) => {
  try {
    const supabase = getSupabase(c.env);
    const projectId = c.req.param('projectId');
    const vendor = c.req.query('vendor');
    const purchaser = c.req.query('purchaser');

    let query = supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('project_id', projectId)
      .order('ordered_at', { ascending: false })
      .order('vendor_name');

    if (vendor) {
      query = query.eq('vendor_name', vendor);
    }
    if (purchaser) {
      query = query.eq('paid_for_by', purchaser);
    }

    const { data, error } = await query;
    if (error) throw error;
    return c.json(data);
  } catch (error: any) {
    console.error('Get all orders error:', error.message);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
});

app.get('/orders/:id', async (c) => {
  try {
    const supabase = getSupabase(c.env);
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*), project:projects(*)')
      .eq('id', c.req.param('id'))
      .single();

    if (error) throw error;
    return c.json(data);
  } catch (error: any) {
    console.error('Get order error:', error.message);
    return c.json({ error: 'Order not found' }, 404);
  }
});

app.put('/orders/:id', async (c) => {
  try {
    const permission = c.get('permission');
    if (!canEdit(permission)) {
      return c.json({ error: 'Editor access required' }, 403);
    }

    const body = await c.req.json();
    const supabase = getSupabase(c.env);

    const updateData: Record<string, any> = {};
    if (body.status) updateData.status = body.status;
    if (body.orderedAt) updateData.ordered_at = body.orderedAt;
    if (body.paidForBy !== undefined) updateData.paid_for_by = body.paidForBy;
    if (body.taxCost !== undefined) updateData.tax_cost = parsePositiveCurrency(body.taxCost);
    if (body.shippingCost !== undefined) updateData.shipping_cost = parsePositiveCurrency(body.shippingCost);
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (typeof body.reimbursed === 'boolean') updateData.reimbursed = body.reimbursed;

    const { data, error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', c.req.param('id'))
      .select('*, order_items(*)')
      .single();

    if (error) throw error;
    return c.json(data);
  } catch (error: any) {
    console.error('Update order error:', error.message);
    return c.json({ error: error.message }, 400);
  }
});

app.delete('/orders/:id', async (c) => {
  try {
    const permission = c.get('permission');
    if (!canEdit(permission)) {
      return c.json({ error: 'Editor access required' }, 403);
    }

    const supabase = getSupabase(c.env);
    const orderId = c.req.param('id');

    // Check for order items
    const { data: items } = await supabase
      .from('order_items')
      .select('id')
      .eq('order_id', orderId)
      .limit(1);

    if (items && items.length > 0) {
      return c.json({ error: "Can't delete a non-empty order" }, 400);
    }

    const { error } = await supabase
      .from('orders')
      .delete()
      .eq('id', orderId);

    if (error) throw error;
    return c.body(null, 204);
  } catch (error: any) {
    console.error('Delete order error:', error.message);
    return c.json({ error: error.message }, 400);
  }
});

// ============================================
// ORDER ITEMS ENDPOINTS
// ============================================

// Get unclassified order items (no order_id)
app.get('/projects/:projectId/order-items/unclassified', async (c) => {
  try {
    const supabase = getSupabase(c.env);
    const projectId = c.req.param('projectId');

    const { data, error } = await supabase
      .from('order_items')
      .select('*')
      .eq('project_id', projectId)
      .is('order_id', null);

    if (error) throw error;
    return c.json(data);
  } catch (error: any) {
    console.error('Get unclassified items error:', error.message);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
});

app.post('/projects/:projectId/order-items', async (c) => {
  try {
    const permission = c.get('permission');
    if (!canEdit(permission)) {
      return c.json({ error: 'Editor access required' }, 403);
    }

    const body = await c.req.json();
    const projectId = c.req.param('projectId');
    const { vendor, quantity, partNumber, description, unitCost, notes } = body;

    const supabase = getSupabase(c.env);

    // Find or create order based on vendor
    let orderId = null;
    if (vendor) {
      const { data: existingOrder } = await supabase
        .from('orders')
        .select('id')
        .eq('project_id', projectId)
        .eq('vendor_name', vendor)
        .eq('status', 'open')
        .single();

      if (existingOrder) {
        orderId = existingOrder.id;
      } else {
        const { data: newOrder } = await supabase
          .from('orders')
          .insert({
            project_id: projectId,
            vendor_name: vendor,
            status: 'open',
          })
          .select('id')
          .single();
        orderId = newOrder?.id;
      }
    }

    const { data, error } = await supabase
      .from('order_items')
      .insert({
        project_id: projectId,
        order_id: orderId,
        quantity: Math.max(1, Math.min(10000, parseInt(quantity) || 1)),
        part_number: partNumber || '',
        description: description || '',
        unit_cost: parsePositiveCurrency(unitCost),
        notes: notes || '',
      })
      .select()
      .single();

    if (error) throw error;
    return c.json(data, 201);
  } catch (error: any) {
    console.error('Create order item error:', error.message);
    return c.json({ error: error.message }, 400);
  }
});

app.put('/order-items/:id', async (c) => {
  try {
    const permission = c.get('permission');
    if (!canEdit(permission)) {
      return c.json({ error: 'Editor access required' }, 403);
    }

    const body = await c.req.json();
    const supabase = getSupabase(c.env);
    const itemId = c.req.param('id');

    // Get current item to check project_id
    const { data: currentItem } = await supabase
      .from('order_items')
      .select('project_id, order_id')
      .eq('id', itemId)
      .single();

    if (!currentItem) {
      return c.json({ error: 'Order item not found' }, 404);
    }

    // Handle vendor change
    let orderId = currentItem.order_id;
    if (body.vendor !== undefined) {
      if (body.vendor) {
        const { data: existingOrder } = await supabase
          .from('orders')
          .select('id')
          .eq('project_id', currentItem.project_id)
          .eq('vendor_name', body.vendor)
          .eq('status', 'open')
          .single();

        if (existingOrder) {
          orderId = existingOrder.id;
        } else {
          const { data: newOrder } = await supabase
            .from('orders')
            .insert({
              project_id: currentItem.project_id,
              vendor_name: body.vendor,
              status: 'open',
            })
            .select('id')
            .single();
          orderId = newOrder?.id || null;
        }
      } else {
        orderId = null;
      }
    }

    const updateData: Record<string, any> = { order_id: orderId };
    if (body.quantity !== undefined) updateData.quantity = Math.max(1, Math.min(10000, parseInt(body.quantity) || 1));
    if (body.partNumber !== undefined) updateData.part_number = body.partNumber;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.unitCost !== undefined) updateData.unit_cost = parsePositiveCurrency(body.unitCost);
    if (body.notes !== undefined) updateData.notes = body.notes;

    const { data, error } = await supabase
      .from('order_items')
      .update(updateData)
      .eq('id', itemId)
      .select()
      .single();

    if (error) throw error;
    return c.json(data);
  } catch (error: any) {
    console.error('Update order item error:', error.message);
    return c.json({ error: error.message }, 400);
  }
});

app.delete('/order-items/:id', async (c) => {
  try {
    const permission = c.get('permission');
    if (!canEdit(permission)) {
      return c.json({ error: 'Editor access required' }, 403);
    }

    const supabase = getSupabase(c.env);
    const { error } = await supabase
      .from('order_items')
      .delete()
      .eq('id', c.req.param('id'));

    if (error) throw error;
    return c.body(null, 204);
  } catch (error: any) {
    console.error('Delete order item error:', error.message);
    return c.json({ error: error.message }, 400);
  }
});

// ============================================
// ORDER STATISTICS
// ============================================

app.get('/projects/:projectId/orders/stats', async (c) => {
  try {
    const supabase = getSupabase(c.env);
    const projectId = c.req.param('projectId');

    // Get all non-open orders with their items
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('project_id', projectId)
      .neq('status', 'open');

    if (error) throw error;

    // Group by vendor
    const byVendor: Record<string, { orders: any[]; totalCost: number }> = {};
    for (const order of orders || []) {
      if (!byVendor[order.vendor_name]) {
        byVendor[order.vendor_name] = { orders: [], totalCost: 0 };
      }
      const itemsCost = (order.order_items || []).reduce(
        (sum: number, item: any) => sum + item.quantity * item.unit_cost,
        0
      );
      const totalCost = itemsCost + (order.tax_cost || 0) + (order.shipping_cost || 0);
      byVendor[order.vendor_name].orders.push({ ...order, totalCost });
      byVendor[order.vendor_name].totalCost += totalCost;
    }

    // Group by purchaser
    const byPurchaser: Record<string, { reimbursed: number; outstanding: number }> = {};
    for (const order of orders || []) {
      const purchaser = order.paid_for_by || 'Unknown';
      if (!byPurchaser[purchaser]) {
        byPurchaser[purchaser] = { reimbursed: 0, outstanding: 0 };
      }
      const itemsCost = (order.order_items || []).reduce(
        (sum: number, item: any) => sum + item.quantity * item.unit_cost,
        0
      );
      const totalCost = itemsCost + (order.tax_cost || 0) + (order.shipping_cost || 0);
      if (order.reimbursed) {
        byPurchaser[purchaser].reimbursed += totalCost;
      } else {
        byPurchaser[purchaser].outstanding += totalCost;
      }
    }

    return c.json({ byVendor, byPurchaser });
  } catch (error: any) {
    console.error('Get order stats error:', error.message);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
});

// ============================================
// SETTINGS ENDPOINT
// ============================================

app.get('/settings', async (c) => {
  try {
    const supabase = getSupabase(c.env);

    // Get or create settings
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .single();

    if (error && error.code === 'PGRST116') {
      // No settings row, return defaults
      return c.json({ hide_unused_fields: false });
    }
    if (error) throw error;
    return c.json(data);
  } catch (error: any) {
    console.error('Get settings error:', error.message);
    return c.json({ hide_unused_fields: false });
  }
});

app.put('/settings', async (c) => {
  try {
    const permission = c.get('permission');
    if (!canAdmin(permission)) {
      return c.json({ error: 'Admin access required' }, 403);
    }

    const body = await c.req.json();
    const supabase = getSupabase(c.env);

    // Upsert settings
    const { data, error } = await supabase
      .from('settings')
      .upsert({
        id: 1,
        hide_unused_fields: body.hideUnusedFields ?? false,
      })
      .select()
      .single();

    if (error) throw error;
    return c.json(data);
  } catch (error: any) {
    console.error('Update settings error:', error.message);
    return c.json({ error: error.message }, 400);
  }
});

// ============================================
// VENDORS ENDPOINT (for autocomplete)
// ============================================

app.get('/vendors', async (c) => {
  try {
    const supabase = getSupabase(c.env);
    const { data, error } = await supabase
      .from('orders')
      .select('vendor_name')
      .order('vendor_name');

    if (error) throw error;

    // Get unique vendor names
    const vendors = [...new Set((data || []).map(o => o.vendor_name))].filter(Boolean);
    return c.json(vendors);
  } catch (error: any) {
    console.error('Get vendors error:', error.message);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
});

export default app;

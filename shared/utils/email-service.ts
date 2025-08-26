import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface EmailConfig {
  host?: string;
  port?: number;
  secure?: boolean;
  auth?: {
    user: string;
    pass: string;
  };
  service?: string; // For services like Gmail, Outlook, etc.
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export class EmailService {
  private transporter: Transporter;

  constructor(config?: EmailConfig) {
    // Default configuration for development (uses ethereal email)
    const defaultConfig: EmailConfig = {
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      } : undefined,
    };

    this.transporter = nodemailer.createTransporter(config || defaultConfig);
  }

  async sendEmail(params: {
    to: string;
    subject: string;
    html: string;
    text?: string;
    from?: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const result = await this.transporter.sendMail({
        from: params.from || process.env.FROM_EMAIL || 'noreply@pathfinder.com',
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text || this.stripHtml(params.html),
      });

      return {
        success: true,
        messageId: result.messageId,
      };
    } catch (error) {
      console.error('Email sending failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async sendWelcomeEmail(email: string, firstName: string, verificationToken?: string): Promise<{ success: boolean; error?: string }> {
    const template = this.getWelcomeTemplate(firstName, verificationToken);
    const result = await this.sendEmail({
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });

    return { success: result.success, error: result.error };
  }

  async sendPasswordResetEmail(email: string, firstName: string, resetToken: string): Promise<{ success: boolean; error?: string }> {
    const template = this.getPasswordResetTemplate(firstName, resetToken);
    const result = await this.sendEmail({
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });

    return { success: result.success, error: result.error };
  }

  async sendEmailVerificationEmail(email: string, firstName: string, verificationToken: string): Promise<{ success: boolean; error?: string }> {
    const template = this.getEmailVerificationTemplate(firstName, verificationToken);
    const result = await this.sendEmail({
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });

    return { success: result.success, error: result.error };
  }

  async sendSecurityAlertEmail(email: string, firstName: string, action: string, ipAddress?: string, deviceInfo?: string): Promise<{ success: boolean; error?: string }> {
    const template = this.getSecurityAlertTemplate(firstName, action, ipAddress, deviceInfo);
    const result = await this.sendEmail({
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });

    return { success: result.success, error: result.error };
  }

  private getWelcomeTemplate(firstName: string, verificationToken?: string): EmailTemplate {
    const baseUrl = process.env.APP_URL || 'http://localhost:5000';
    const verificationUrl = verificationToken ? `${baseUrl}/verify-email?token=${verificationToken}` : null;

    return {
      subject: 'Welcome to Pathfinder Platform!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Welcome to Pathfinder Platform!</h2>
          <p>Hello ${firstName},</p>
          <p>Welcome to Pathfinder Platform! Your account has been successfully created.</p>
          
          ${verificationUrl ? `
            <p>To get started, please verify your email address by clicking the button below:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Verify Email Address
              </a>
            </div>
            <p><small>If the button doesn't work, copy and paste this link into your browser: ${verificationUrl}</small></p>
          ` : ''}
          
          <p>If you have any questions, feel free to contact our support team.</p>
          <p>Best regards,<br>The Pathfinder Team</p>
        </div>
      `,
      text: `Welcome to Pathfinder Platform!

Hello ${firstName},

Welcome to Pathfinder Platform! Your account has been successfully created.

${verificationUrl ? `To get started, please verify your email address by visiting: ${verificationUrl}` : ''}

If you have any questions, feel free to contact our support team.

Best regards,
The Pathfinder Team`,
    };
  }

  private getPasswordResetTemplate(firstName: string, resetToken: string): EmailTemplate {
    const baseUrl = process.env.APP_URL || 'http://localhost:5000';
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

    return {
      subject: 'Password Reset Request',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Password Reset Request</h2>
          <p>Hello ${firstName},</p>
          <p>We received a request to reset your password for your Pathfinder Platform account.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Reset Password
            </a>
          </div>
          
          <p><small>If the button doesn't work, copy and paste this link into your browser: ${resetUrl}</small></p>
          
          <p style="color: #dc2626; background-color: #fef2f2; padding: 12px; border-radius: 5px;">
            <strong>Security Notice:</strong> This link will expire in 24 hours. If you didn't request this password reset, please ignore this email or contact support if you're concerned about your account security.
          </p>
          
          <p>Best regards,<br>The Pathfinder Team</p>
        </div>
      `,
      text: `Password Reset Request

Hello ${firstName},

We received a request to reset your password for your Pathfinder Platform account.

To reset your password, visit: ${resetUrl}

Security Notice: This link will expire in 24 hours. If you didn't request this password reset, please ignore this email or contact support if you're concerned about your account security.

Best regards,
The Pathfinder Team`,
    };
  }

  private getEmailVerificationTemplate(firstName: string, verificationToken: string): EmailTemplate {
    const baseUrl = process.env.APP_URL || 'http://localhost:5000';
    const verificationUrl = `${baseUrl}/verify-email?token=${verificationToken}`;

    return {
      subject: 'Verify Your Email Address',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Verify Your Email Address</h2>
          <p>Hello ${firstName},</p>
          <p>Please verify your email address to complete your account setup.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" style="background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Verify Email Address
            </a>
          </div>
          
          <p><small>If the button doesn't work, copy and paste this link into your browser: ${verificationUrl}</small></p>
          
          <p>If you didn't create an account with Pathfinder Platform, please ignore this email.</p>
          
          <p>Best regards,<br>The Pathfinder Team</p>
        </div>
      `,
      text: `Verify Your Email Address

Hello ${firstName},

Please verify your email address to complete your account setup.

Visit: ${verificationUrl}

If you didn't create an account with Pathfinder Platform, please ignore this email.

Best regards,
The Pathfinder Team`,
    };
  }

  private getSecurityAlertTemplate(firstName: string, action: string, ipAddress?: string, deviceInfo?: string): EmailTemplate {
    return {
      subject: 'Security Alert - Account Activity',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">Security Alert</h2>
          <p>Hello ${firstName},</p>
          <p>We're writing to inform you about recent activity on your Pathfinder Platform account:</p>
          
          <div style="background-color: #fef2f2; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Action:</strong> ${action}</p>
            ${ipAddress ? `<p><strong>IP Address:</strong> ${ipAddress}</p>` : ''}
            ${deviceInfo ? `<p><strong>Device:</strong> ${deviceInfo}</p>` : ''}
            <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
          </div>
          
          <p>If this was you, no action is needed. If you don't recognize this activity, please:</p>
          <ol>
            <li>Change your password immediately</li>
            <li>Review your account settings</li>
            <li>Contact our support team</li>
          </ol>
          
          <p>Best regards,<br>The Pathfinder Security Team</p>
        </div>
      `,
      text: `Security Alert

Hello ${firstName},

We're writing to inform you about recent activity on your Pathfinder Platform account:

Action: ${action}
${ipAddress ? `IP Address: ${ipAddress}` : ''}
${deviceInfo ? `Device: ${deviceInfo}` : ''}
Time: ${new Date().toLocaleString()}

If this was you, no action is needed. If you don't recognize this activity, please:
1. Change your password immediately
2. Review your account settings
3. Contact our support team

Best regards,
The Pathfinder Security Team`,
    };
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      console.error('Email service verification failed:', error);
      return false;
    }
  }
}

// Singleton instance
let emailService: EmailService | null = null;

export function getEmailService(): EmailService {
  if (!emailService) {
    emailService = new EmailService();
  }
  return emailService;
}
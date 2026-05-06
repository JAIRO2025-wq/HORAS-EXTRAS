'use client';

type LogEvent = {
  eventType: 
    | 'admin_login' 
    | 'employee_login' 
    | 'record_created' 
    | 'record_updated' 
    | 'record_deleted' 
    | 'employee_created' 
    | 'employee_updated' 
    | 'branch_created' 
    | 'branch_updated' 
    | 'branch_deleted' 
    | 'device_authorized' 
    | 'device_revoked';
  message: string;
};

export const logEvent = async (event: LogEvent) => {
  try {
    await fetch('/api/log-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
  } catch (error) {
    // Silently fail. We don't want to interrupt the user flow for logging.
    console.error('Failed to log event:', error);
  }
};

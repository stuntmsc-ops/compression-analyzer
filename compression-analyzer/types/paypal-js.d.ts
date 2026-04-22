/** Minimal typings for the PayPal JS SDK loaded from paypal.com/sdk/js */

export {};

type PayPalSubscriptionActions = {
  subscription: {
    create: (opts: { plan_id: string; custom_id?: string }) => Promise<string>;
  };
};

type PayPalButtonsInstance = {
  render: (container: HTMLElement) => Promise<void>;
  close: () => void;
};

type PayPalButtonsOptions = {
  style?: Record<string, string>;
  /** One-time / order checkout */
  createOrder?: () => Promise<string>;
  createSubscription?: (
    data: unknown,
    actions: PayPalSubscriptionActions,
  ) => Promise<string>;
  onApprove?: (data: {
    subscriptionID?: string;
    orderID?: string;
    orderId?: string;
  }) => Promise<void>;
  onError?: (err: unknown) => void;
  onCancel?: () => void;
};

declare global {
  interface Window {
    paypal?: {
      Buttons: (options: PayPalButtonsOptions) => PayPalButtonsInstance;
    };
  }
}

export type AuthStackParamList = {
  DriverLogin: undefined;
  OtpVerify: { phone: string };
};

export type DriverTabParamList = {
  DriverHome: undefined;
  DriverProfile: undefined;
};

export type DriverStackParamList = {
  DriverTabs: undefined;
  OrderActive: { orderId: number };
  Stats: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  DriverApp: undefined;
};

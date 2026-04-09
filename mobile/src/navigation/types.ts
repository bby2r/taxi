export type AuthStackParamList = {
  PhoneLogin: undefined;
  OtpVerify: { phone: string };
  DriverLogin: undefined;
};

export type ClientTabParamList = {
  Home: undefined;
  History: undefined;
  Profile: undefined;
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
  ClientApp: undefined;
  DriverApp: undefined;
};

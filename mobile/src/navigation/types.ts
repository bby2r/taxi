export type AuthStackParamList = {
  PhoneLogin: undefined;
  OtpVerify: { phone: string };
};

export type ClientTabParamList = {
  Home: undefined;
  History: undefined;
};

export type DriverStackParamList = {
  DriverHome: undefined;
  OrderActive: { orderId: number };
  Stats: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  ClientApp: undefined;
  DriverApp: undefined;
};

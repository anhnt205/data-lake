import { useNavigate } from "react-router-dom";
import logo from "../../file/loo.png";
import {
  MailOutlined,
  PhoneOutlined,
} from "@ant-design/icons";

export const COMPANY_NAME = "CÔNG TY THAN DƯƠNG HUY - TKV";

const Header = () => {
  const navigate = useNavigate();

  return (
    <header className="w-full">
      <div
        className={`bg-[#1976D2] border-b border-cyan-600 transition-all duration-300 overflow-hidden`}
      >
        <div
          className={`flex items-center justify-center px-6 py-3 text-white transition-all duration-300 `}
        >
          <img
            src={logo}
            className="h-14 w-20 rounded-full cursor-pointer"
            onClick={() => navigate("/dashboard")}
          />

          <div className="ml-4 text-center">
            <div className="text-2xl font-bold">
              PHẦN MỀM QUẢN LÝ KHO DỮ LIỆU
            </div>
            <div className="text-base font-bold">
              {COMPANY_NAME}
            </div>

            <div className="flex justify-center gap-6 text-sm mt-1">
              <span className="flex items-center gap-1">
                <PhoneOutlined />  02033.862.238
              </span>
              <span className="flex items-center gap-1">
                <MailOutlined /> 02033.862.494
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;

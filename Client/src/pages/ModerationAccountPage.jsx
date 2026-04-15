import { useOutletContext } from 'react-router-dom';
import Header from '../components/Header';
import AppealCenter from '../components/appeals/AppealCenter';

export default function ModerationAccountPage() {
  const { onMenuToggle } = useOutletContext();
  return (
    <div className="animate-fade-in">
      <Header title="Moderation & appeals" onMenuClick={onMenuToggle} />
      <AppealCenter variant="default" />
    </div>
  );
}

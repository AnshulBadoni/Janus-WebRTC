import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ReactiveFormsModule, FormsModule} from '@angular/forms'
import Janus from 'janus-gateway';
@Component({
  selector: 'app-remote-room',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule],
  templateUrl: './remote-room.component.html',
  styleUrl: './remote-room.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RemoteRoomComponent {

  janusRef!: Janus;
  remoteFeed!: any;
}

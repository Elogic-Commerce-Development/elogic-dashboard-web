type Props = {
  displayName?: string
  userClass?: string | null
}

export function UnlinkedEmployeeBanner({ displayName, userClass }: Props) {
  const isClient = userClass === 'Client'

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <div className="font-medium">No PeopleForce link — utilization unavailable.</div>
      <p className="mt-1 text-xs">
        {isClient
          ? `${displayName ?? 'This user'} is a client (class=Client) in ActiveCollab and isn't expected to have a PeopleForce profile.`
          : `${displayName ?? 'This user'} doesn't have an "AC ID" set in PeopleForce. Ask HR to populate the field on the employee profile, then re-run \`php artisan pf:sync:employees\`.`}
      </p>
    </div>
  )
}

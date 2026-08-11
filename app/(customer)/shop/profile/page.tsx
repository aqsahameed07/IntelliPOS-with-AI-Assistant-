'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export default function ProfilePage() {
  const { user, updateProfile, logout } = useAuth()
  const [form, setForm] = useState({
    name: user?.name ?? '',
    phone: user?.phone ?? '',
    address: user?.address ?? '',
  })

  const save = () => {
    updateProfile(form)
    toast.success('Profile updated successfully')
  }

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold">Profile</h1>
      <Card>
        <CardContent className="space-y-3 p-6">
          <F label="Name">
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Enter your full name"
            />
          </F>
          <F label="Email">
            <Input value={user?.email ?? ''} disabled className="bg-muted" />
          </F>
          <F label="Phone">
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="Enter your phone number"
              type="tel"
            />
          </F>
          <F label="Address">
            <Input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Enter your shipping address"
            />
          </F>
          <div className="flex justify-between pt-2">
            <Button
              variant="outline"
              onClick={() => {
                logout()
                toast.info('Logged out successfully')
              }}
            >
              Log out
            </Button>
            <Button onClick={save}>Save changes</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}